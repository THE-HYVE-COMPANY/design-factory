// [DEPRECATED] PublishDialog — the in-app Vercel publish UI is not
// part of the current public surface.
//
// This file is PRESERVED (not deleted) for a future polished surface.
// No JSX renders this component anymore (EditorScreen.tsx no longer
// imports/mounts it). Daemon endpoints (/deploy/vercel/*,
// /vercel/projects/*, /vercel/teams, /vercel/user) are also deprecated
// but preserved — see apps/daemon/src/index.mjs.
//
// === ORIGINAL DOC (kept for future planning) =================================
//
// PublishDialog — Share menu → "Publicar no Vercel" → opens a real
// dialog instead of immediately POSTing /deploy/vercel.
//
// "ja poder escolher projeto
// em q quer publicar, nome da pagina etc?". The old flow had two menu
// items (Preview / Production) that fired the deploy directly with the
// projectName == slug(projectName). The new flow shows:
//   1. Connected profile (avatar + username) — proof of who's publishing
//   2. Project picker (existing Vercel projects + "Create new")
//   3. Page name input (defaults to slug(projectName), editable)
//   4. Environment toggle (Preview default — safer for iteration)
//   5. Publish → existing 3-stage progress toasts
//
// If the user isn't connected we show a friendly "Configure first"
// CTA that links to Settings → Providers (no in-dialog token paste —
// that surface stays canonical in Settings to avoid duplicating UI).
//
// Project picker scope. The daemon used to list only personal-account
// projects, which hid team-scoped projects from the publish flow.
// The picker now covers:
//   · Hero account label ("Conta: hyve-company · via Vercel CLI")
//   · Radio toggle "Criar novo" vs "Usar existente" — clarifies intent
//   · SearchableDropdown grouped by team (Personal first, then teams)
//   · Inline name validation when creating new (debounced check)
//   · Project preview chip when an existing one is selected (last
//     deploy + framework, so the user confirms scope before deploying)
//   · Loading skeleton + reload affordance + WCAG-aware focus.
//
// Publish lifecycle. The dialog owns the full publish lifecycle as a
// state machine with four modes:
//   · "form" — selection (default)
//   · "publishing" — persistent overlay with 4 step rows + elapsed clock
//   · "success" — final URL card with Copiar / Abrir actions
//   · "error" — error card with retry affordance
// The host (EditorScreen) keeps the dialog mounted across the whole
// lifecycle so the user always sees what's happening; the older
// ephemeral-toast flow is gone — the overlay replaces it entirely.
//
// State machine for the publishing mode:
//   Step 1 "bundling" — sync, ~200ms artificial pause so the user
//                          sees the row light up before step 2 starts.
//   Step 2 "uploading" — POST /deploy/vercel; resolves with deploymentId
//                          while Vercel keeps building.
//   Step 3 "building" — poll GET /deploy/vercel/status every 1.5s
//                          (cheap, ~80B per call) until readyState ===
//                          "READY", "ERROR", or "CANCELED".
//   Step 4 "publishing" — short tail (alias resolution); folds into READY
//                          completion in practice but is shown so the
//                          step list reads like a checklist.
// Timeout: 60 polls × 1.5s = 90s ceiling. After that we surface a
// "deploy demorou demais" error and let the user retry.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getVercelConfigState,
  getVercelUser,
  listVercelAllProjects,
  checkVercelProjectName,
  deployVercel,
  getDeployStatus,
  type VercelProject,
  type VercelUserProfile,
  type VercelTeam,
  type VercelProjectNameAvailability,
  type VercelDeploymentState,
} from "@/lib/vercel-bridge";
import { SearchableDropdown, type SearchableDropdownItem } from "@/components/SearchableDropdown";
import { useT } from "@/i18n";

export interface PublishDialogProps {
  /** Default page name — usually the project slug from the editor. */
  defaultPageName: string;
  /** the dialog now performs the deploy itself so it can drive the
   *  in-dialog progress overlay. The host supplies the HTML payload (the
   *  composed iframe markup). The dialog calls deployVercel + polls
   *  status; on success it surfaces the live URL and triggers
   *  onSuccess (host opens the URL / records the publish in history). */
  iframeHtml: string;
  /** Fired on success with the live URL — the host can open it, log
   *  it, or anything else. Optional. */
  onSuccess?: (input: { url: string; deploymentId: string; target: "preview" | "production" }) => void;
  /** Close the dialog without publishing. Also called after the user
   *  closes a success/error overlay. */
  onClose: () => void;
}

function slugify(input: string): string {
  return String(input || "design")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "design";
}

type ProjectMode = "new" | "existing";

/** top-level dialog mode. Drives which surface renders. */
type DialogMode = "form" | "publishing" | "success" | "error";

/** step in the publishing lifecycle. */
type PublishStep = "bundling" | "uploading" | "building" | "publishing";

const PUBLISH_STEPS: PublishStep[] = ["bundling", "uploading", "building", "publishing"];

interface EnrichedProject extends VercelProject {
  teamId: string | null;
  teamSlug?: string | null;
  teamName?: string | null;
}

export function PublishDialog({ defaultPageName, iframeHtml, onSuccess, onClose }: PublishDialogProps) {
  const { t, tf } = useT();
  const defaultSlug = useMemo(() => slugify(defaultPageName), [defaultPageName]);

  // Connection / fetch state
  const [tokenSet, setTokenSet] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<VercelUserProfile | null>(null);
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [teams, setTeams] = useState<VercelTeam[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [mode, setMode] = useState<ProjectMode>("new");
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pageName, setPageName] = useState<string>(defaultSlug);
  /** separate name when creating new — defaults to pageName slug
   *  but can be overridden so the project name doesn't have to match
   *  the page name 1:1. */
  const [newProjectName, setNewProjectName] = useState<string>(defaultSlug);
  const [target, setTarget] = useState<"preview" | "production">("preview");

  // dialog state machine.
  const [dialogMode, setDialogMode] = useState<DialogMode>("form");
  const [currentStep, setCurrentStep] = useState<PublishStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<PublishStep[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const cancelledRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const elapsedTimerRef = useRef<number | null>(null);

  // Inline name validation — debounced.
  const [nameCheck, setNameCheck] = useState<VercelProjectNameAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const checkTimerRef = useRef<number | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);

  // Initial load — fetch profile + aggregated projects in parallel.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cfg = await getVercelConfigState();
      if (cancelled) return;
      setTokenSet(cfg.tokenSet);
      if (!cfg.tokenSet) { setLoadingProjects(false); return; }
      const [p, all] = await Promise.all([
        getVercelUser(),
        listVercelAllProjects({ limit: 200 }),
      ]);
      if (cancelled) return;
      setProfile(p);
      if (all.ok) {
        setProjects(all.projects.map((pr) => ({
          ...pr,
          teamId: pr.teamId ?? null,
          teamSlug: pr.teamSlug ?? null,
          teamName: pr.teamName ?? null,
        })));
        setTeams(all.teams);
      } else if (all.error) {
        setFetchError(all.error);
      }
      setLoadingProjects(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup timers + cancel polling on unmount.
  useEffect(() => () => {
    cancelledRef.current = true;
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    if (checkTimerRef.current) window.clearTimeout(checkTimerRef.current);
  }, []);

  // ESC closes the form mode. During publishing/success/error we still
  // honour ESC but the host treats it as a confirm-to-close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialogMode === "publishing") {
        // Publishing in flight — confirm cancel first. Soft cancel: we
        // stop the poll loop but the deployment keeps going server-side
        // (Vercel doesn't expose a cancel API for our scopes). The
        // user can re-poll later via the deploy list.
        cancelledRef.current = true;
        onClose();
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dialogMode]);

  // Debounced project-name availability check (only relevant when creating new).
  useEffect(() => {
    if (mode !== "new" || dialogMode !== "form") { setNameCheck(null); setChecking(false); return; }
    if (checkTimerRef.current) window.clearTimeout(checkTimerRef.current);
    const slug = slugify(newProjectName);
    if (!slug || slug === "design") {
      setNameCheck({ ok: true, available: false, name: slug, reason: "invalid" });
      setChecking(false);
      return;
    }
    setChecking(true);
    setNameCheck(null);
    // 350ms keeps the request count low while staying snappy. Cancellation
    // is implicit — a stale callback compares its slug against the current
    // newProjectName below and bails if drift happened.
    const timer = window.setTimeout(async () => {
      const result = await checkVercelProjectName(slug, {});
      // Drift guard: if the user kept typing and the slug changed by the
      // time we resolved, ignore this result.
      if (slugify(newProjectName) !== slug) return;
      setNameCheck(result);
      setChecking(false);
    }, 350);
    checkTimerRef.current = timer;
    return () => { window.clearTimeout(timer); };
  }, [newProjectName, mode, dialogMode]);

  // Group projects by scope label for the picker.
  const dropdownItems = useMemo<SearchableDropdownItem<EnrichedProject>[]>(() => {
    const items: SearchableDropdownItem<EnrichedProject>[] = [];
    // Personal bucket first — always rendered even if empty (so the user
    // sees the scope structure).
    const personal = projects.filter((p) => !p.teamId);
    if (personal.length > 0) {
      personal.forEach((p) => items.push({
        id: p.id,
        label: p.name,
        sub: p.framework ? t("publish.project.framework").replace("{0}", p.framework) : undefined,
        searchText: `${p.name} personal pessoal`,
        payload: p,
        group: "__personal__",
        groupLabel: t("publish.scope.personal"),
      }));
    }
    // Then each team bucket — preserve the order the daemon returned.
    teams.forEach((tm) => {
      const teamProjects = projects.filter((p) => p.teamId === tm.id);
      teamProjects.forEach((p) => items.push({
        id: p.id,
        label: p.name,
        sub: p.framework ? t("publish.project.framework").replace("{0}", p.framework) : undefined,
        searchText: `${p.name} ${tm.slug} ${tm.name}`,
        payload: p,
        group: tm.id,
        groupLabel: tf("publish.scope.team", tm.name),
      }));
    });
    return items;
  }, [projects, teams, t, tf]);

  const pickedProject = useMemo<EnrichedProject | null>(() => {
    if (!pickedProjectId) return null;
    return projects.find((p) => p.id === pickedProjectId) ?? null;
  }, [pickedProjectId, projects]);

  // Trigger label — what the picker button shows.
  const triggerLabel = useMemo(() => {
    if (loadingProjects) return t("publish.project.loading");
    if (!pickedProject) return t("publish.project.pick");
    return pickedProject.name;
  }, [loadingProjects, pickedProject, t]);

  const triggerSub = useMemo(() => {
    if (!pickedProject) return null;
    if (pickedProject.teamName) return tf("publish.scope.team", pickedProject.teamName);
    return t("publish.scope.personal");
  }, [pickedProject, t, tf]);

  // Final URL preview — purely cosmetic, drives the hint under inputs.
  const finalUrlPreview = useMemo(() => {
    if (mode === "existing" && pickedProject) {
      // Production goes straight to the project's main domain; preview is
      // a unique hash that the API generates server-side, so we surface
      // the project name and let Vercel decorate.
      if (target === "production") return `${pickedProject.name}.vercel.app`;
      return `${pickedProject.name}-{hash}.vercel.app`;
    }
    // Creating new: the project will own the page slug.
    return `${slugify(newProjectName) || defaultSlug}.vercel.app`;
  }, [mode, pickedProject, target, newProjectName, defaultSlug]);

  // Account label — composes a short string for the hero.
  const accountLabel = useMemo(() => {
    if (!profile?.ok) return null;
    const sourceLabel = profile.source === "vercel-cli"
      ? t("publish.account.via.cli")
      : t("publish.account.via.byok");
    const main = tf("publish.account.label", profile.username || "—");
    return `${main} · ${sourceLabel}`;
  }, [profile, t, tf]);

  const canPublish = useMemo(() => {
    if (!tokenSet || !profile?.ok || dialogMode !== "form") return false;
    if (!pageName.trim()) return false;
    if (mode === "existing") return !!pickedProject;
    if (mode === "new") {
      // Allow publish even if the check is in flight — Vercel will create
      // the project on the deploy call. We only block when we have a hard
      // negative (already exists / invalid).
      if (nameCheck && nameCheck.ok && !nameCheck.available) return false;
      return true;
    }
    return false;
  }, [tokenSet, profile, dialogMode, pageName, mode, pickedProject, nameCheck]);

  // ─── publish lifecycle ─────────────────────────────────────
  const handlePublish = async () => {
    // Snapshot resolved values so re-renders during publishing don't
    // change them.
    let projectName: string;
    let projectId: string | null = null;
    let teamId: string | null = null;
    if (mode === "existing" && pickedProject) {
      projectName = pickedProject.name;
      projectId = pickedProject.id;
      teamId = pickedProject.teamId;
    } else {
      projectName = slugify(newProjectName) || defaultSlug;
    }
    const slug = slugify(pageName);

    // Reset lifecycle state and enter publishing mode.
    cancelledRef.current = false;
    setResultUrl(null);
    setResultError(null);
    setCompletedSteps([]);
    setCurrentStep("bundling");
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setDialogMode("publishing");
    // Elapsed clock — updates every 250ms so the row reads "12s" smoothly
    // without forcing a re-render every frame.
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = window.setInterval(() => {
      if (cancelledRef.current) return;
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);

    // Step 1: bundling — short artificial delay so the user sees the
    // row transition before the upload starts. The actual bundle happens
    // in the host (iframeHtml is already composed).
    await new Promise((r) => setTimeout(r, 200));
    if (cancelledRef.current) return;
    setCompletedSteps((prev) => [...prev, "bundling"]);
    setCurrentStep("uploading");

    // Step 2: uploading — POST /deploy/vercel. This returns once Vercel
    // has accepted the files; build is still queued/building afterwards.
    const deploy = await deployVercel({
      slug,
      projectName,
      html: iframeHtml,
      target,
      ...(projectId ? { projectId } : {}),
      ...(teamId !== null && teamId !== undefined ? { teamId } : {}),
    });
    if (cancelledRef.current) return;
    if (!deploy.ok || !deploy.deploymentId) {
      setResultError((deploy.error ?? "unknown").slice(0, 200));
      setDialogMode("error");
      stopElapsedClock();
      return;
    }
    setCompletedSteps((prev) => [...prev, "uploading"]);
    setCurrentStep("building");

    // Step 3 + 4: building → publishing — poll status until READY/ERROR.
    // We treat the alias-resolve tail as a separate step ("publishing")
    // for UX clarity: it reads like a checklist with 4 ticks.
    const POLL_INTERVAL_MS = 1500;
    const MAX_ATTEMPTS = 60; // 90s ceiling
    let attempts = 0;
    let buildingSettled = false;
    while (!cancelledRef.current && attempts < MAX_ATTEMPTS) {
      attempts++;
      const status = await getDeployStatus(deploy.deploymentId, { teamId });
      if (cancelledRef.current) return;
      if (!status.ok) {
        // Transient failures shouldn't break the loop — keep polling
        // until timeout. Log via fetchError for visibility but don't show.
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      if (status.state === "READY") {
        // Once ready we mark both building + publishing as done. If we
        // hadn't marked building yet (Vercel skipped past it) we still
        // catch it here.
        if (!buildingSettled) {
          setCompletedSteps((prev) => [...prev, "building"]);
          buildingSettled = true;
        }
        setCurrentStep("publishing");
        await sleep(150); // Lets the UI render the publishing step before flipping to success.
        if (cancelledRef.current) return;
        setCompletedSteps((prev) => [...prev, "publishing"]);
        setCurrentStep(null);
        const finalUrl = status.url ?? deploy.url ?? null;
        if (finalUrl) {
          setResultUrl(finalUrl);
          setDialogMode("success");
          stopElapsedClock();
          // Auto-copy the URL to clipboard — quiet best-effort. The user
          // also gets a Copiar button on the success card.
          try {
            await navigator.clipboard.writeText(finalUrl);
            setCopyState("copied");
            window.setTimeout(() => setCopyState("idle"), 2000);
          } catch { /* clipboard blocked — ignore. */ }
          if (deploy.deploymentId) {
            onSuccess?.({ url: finalUrl, deploymentId: deploy.deploymentId, target });
          }
        } else {
          // No URL surfaced — treat as error.
          setResultError("URL não foi resolvida pela Vercel");
          setDialogMode("error");
          stopElapsedClock();
        }
        return;
      }
      if (status.state === "ERROR" || status.state === "CANCELED") {
        setResultError(status.errorMessage || "Build falhou");
        setDialogMode("error");
        stopElapsedClock();
        return;
      }
      // BUILDING / INITIALIZING / QUEUED — keep polling. After the first
      // BUILDING signal, the user sees the building step "active".
      if (status.state === "BUILDING" && !buildingSettled) {
        // No-op; we already set currentStep="building" earlier. Kept here
        // for clarity if Vercel ever returns BUILDING after a quick QUEUED.
      }
      await sleep(POLL_INTERVAL_MS);
    }
    // Loop exited without success — timeout.
    if (!cancelledRef.current) {
      setResultError(t("publish.timeout.error"));
      setDialogMode("error");
      stopElapsedClock();
    }
  };

  function stopElapsedClock() {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  const handleCopyUrl = async () => {
    if (!resultUrl) return;
    try {
      await navigator.clipboard.writeText(resultUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch { /* ignore */ }
  };

  const handleOpenUrl = () => {
    if (!resultUrl) return;
    window.open(resultUrl, "_blank", "noopener");
  };

  const handleRetry = () => {
    // Reset to form mode but preserve user choices.
    setDialogMode("form");
    setCurrentStep(null);
    setCompletedSteps([]);
    setResultError(null);
    setElapsedMs(0);
  };

  // Render footer button label.
  const submitButtonLabel = target === "production"
    ? t("publish.submit.prod")
    : t("publish.submit.preview");

  // Format elapsed seconds.
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  return (
    <div
      className="publish-dialog-backdrop"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        // During publishing, backdrop click cancels softly.
        if (dialogMode === "publishing") cancelledRef.current = true;
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dialog-title"
    >
      <div className="publish-dialog">
        <div className="publish-dialog__head">
          <h2 className="publish-dialog__title" id="publish-dialog-title">
            {dialogMode === "success" ? t("publish.success.title")
              : dialogMode === "error" ? t("publish.error.title")
              : dialogMode === "publishing" ? t("publish.publishing.title")
              : t("publish.title")}
          </h2>
          <button
            type="button"
            className="publish-dialog__close"
            onClick={() => {
              if (dialogMode === "publishing") cancelledRef.current = true;
              onClose();
            }}
            aria-label={t("publish.close")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── form mode ──────────────────────────────────────── */}
        {dialogMode === "form" && (
          <>
            {/* hero account label */}
            {tokenSet && profile?.ok && accountLabel ? (
              <p className="publish-dialog__account">{accountLabel}</p>
            ) : (
              <p className="publish-dialog__sub">{t("publish.sub")}</p>
            )}

            {tokenSet === false && (
              <div className="publish-dialog__byok-cta">
                <strong>{t("publish.notconnected.title")}</strong>
                <br />
                {t("publish.notconnected.body")}
                <div className="publish-dialog__footer" style={{ marginTop: 14, paddingTop: 0, borderTop: "none" }}>
                  <button
                    className="df-btn df-btn--secondary"
                    onClick={onClose}
                  >
                    {t("publish.cancel")}
                  </button>
                  <button
                    className="df-btn df-btn--primary"
                    onClick={() => { onClose(); window.location.hash = "#/settings/providers"; }}
                  >
                    {t("publish.opensettings")}
                  </button>
                </div>
              </div>
            )}

            {tokenSet && (
              <>
                {/* Project mode toggle */}
                <div className="publish-dialog__field">
                  <span className="publish-dialog__label">{t("publish.field.project")}</span>
                  <div className="publish-dialog__mode-row" role="radiogroup" aria-label={t("publish.field.project")}>
                    {([
                      { id: "new", label: t("publish.field.project.mode.new") },
                      { id: "existing", label: t("publish.field.project.mode.existing") },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={mode === opt.id}
                        className={`publish-dialog__mode${mode === opt.id ? " is-active" : ""}`}
                        onClick={() => { setMode(opt.id); setPickerOpen(false); }}
                      >
                        <span className="publish-dialog__mode-dot" aria-hidden />
                        <span className="publish-dialog__mode-label">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Existing project picker */}
                {mode === "existing" && (
                  <div className="publish-dialog__field">
                    <label className="publish-dialog__label" htmlFor="publish-project-pick">
                      {t("publish.project.pick")}
                    </label>
                    <div className="publish-dialog__picker-wrap">
                      <button
                        ref={triggerRef}
                        id="publish-project-pick"
                        type="button"
                        className={`publish-dialog__picker-trigger${loadingProjects ? " is-loading" : ""}`}
                        onClick={() => { if (!loadingProjects) setPickerOpen((v) => !v); }}
                        aria-haspopup="listbox"
                        aria-expanded={pickerOpen}
                        disabled={loadingProjects}
                      >
                        <span className="publish-dialog__picker-trigger-text">
                          <span className="publish-dialog__picker-trigger-label">{triggerLabel}</span>
                          {triggerSub && (
                            <span className="publish-dialog__picker-trigger-sub">{triggerSub}</span>
                          )}
                        </span>
                        <span className="publish-dialog__picker-trigger-caret" aria-hidden>›</span>
                      </button>
                      <SearchableDropdown
                        open={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        items={dropdownItems}
                        selectedId={pickedProjectId}
                        onPick={(it) => {
                          setPickedProjectId(it.id);
                          setPickerOpen(false);
                        }}
                        searchPlaceholder={t("publish.project.pick.placeholder")}
                        emptyTemplate={t("publish.project.pick.empty")}
                        width="trigger"
                        ariaLabel={t("publish.project.pick")}
                      />
                    </div>
                    {loadingProjects && (
                      <p className="publish-dialog__hint">{t("publish.project.loading")}</p>
                    )}
                    {!loadingProjects && projects.length === 0 && (
                      <p className="publish-dialog__hint">
                        {t("publish.no.projects")} {t("publish.no.projects.hint")}
                      </p>
                    )}
                    {!loadingProjects && projects.length > 0 && !pickedProject && (
                      <p className="publish-dialog__hint">{tf("publish.project.count", projects.length)}</p>
                    )}
                    {fetchError && !loadingProjects && (
                      <p className="publish-dialog__error" role="alert">{fetchError}</p>
                    )}

                    {pickedProject && (
                      <div className="publish-dialog__project-preview">
                        <div className="publish-dialog__project-preview-row">
                          <span className="publish-dialog__project-preview-name">{pickedProject.name}</span>
                          <span className="publish-dialog__project-preview-scope">{triggerSub}</span>
                        </div>
                        <div className="publish-dialog__project-preview-meta">
                          {pickedProject.framework && (
                            <span>{tf("publish.project.framework", pickedProject.framework)}</span>
                          )}
                          {pickedProject.latestDeployment ? (
                            <span>{tf("publish.project.last.deploy", pickedProject.latestDeployment.replace(/^https?:\/\//, ""))}</span>
                          ) : (
                            <span>{t("publish.project.no.deploys")}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* New project name input */}
                {mode === "new" && (
                  <div className="publish-dialog__field">
                    <label className="publish-dialog__label" htmlFor="publish-projname">
                      {t("publish.field.projname")}
                    </label>
                    <input
                      id="publish-projname"
                      type="text"
                      className="provider-oauth-input"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder={defaultSlug}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <p className={`publish-dialog__name-status${
                      checking ? " is-checking"
                      : nameCheck && nameCheck.ok && nameCheck.available ? " is-ok"
                      : nameCheck && nameCheck.ok && !nameCheck.available ? " is-error"
                      : ""
                    }`}>
                      {checking
                        ? t("publish.field.projname.checking")
                        : nameCheck && nameCheck.ok && nameCheck.available
                          ? `✓ ${slugify(newProjectName)}.vercel.app · ${t("publish.field.projname.available")}`
                          : nameCheck && nameCheck.ok && !nameCheck.available && nameCheck.reason === "invalid"
                            ? t("publish.field.projname.invalid")
                            : nameCheck && nameCheck.ok && !nameCheck.available && nameCheck.reason === "exists"
                              ? t("publish.field.projname.exists")
                              : tf("publish.field.projname.hint", profile?.teamLabel || t("publish.scope.personal"))}
                    </p>
                  </div>
                )}

                {/* Page name */}
                <div className="publish-dialog__field">
                  <label className="publish-dialog__label" htmlFor="publish-pagename">
                    {t("publish.field.pagename")}
                  </label>
                  <input
                    id="publish-pagename"
                    type="text"
                    className="provider-oauth-input"
                    value={pageName}
                    onChange={(e) => setPageName(e.target.value)}
                    placeholder={defaultSlug}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <p className="publish-dialog__hint">
                    {tf("publish.field.pagename.hint", finalUrlPreview)}
                  </p>
                </div>

                {/* Environment */}
                <div className="publish-dialog__field">
                  <span className="publish-dialog__label">{t("publish.field.env")}</span>
                  <div className="publish-dialog__radio-row">
                    {([
                      { id: "preview", title: t("publish.env.preview.title"), sub: t("publish.env.preview.sub") },
                      { id: "production", title: t("publish.env.prod.title"), sub: t("publish.env.prod.sub") },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`publish-dialog__radio${target === opt.id ? " is-active" : ""}`}
                        onClick={() => setTarget(opt.id)}
                        aria-pressed={target === opt.id}
                      >
                        <span className="publish-dialog__radio-title">{opt.title}</span>
                        <span className="publish-dialog__radio-sub">{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="publish-dialog__footer">
                  <button
                    className="df-btn df-btn--secondary"
                    onClick={onClose}
                  >
                    {t("publish.cancel")}
                  </button>
                  <button
                    className="df-btn df-btn--primary"
                    onClick={handlePublish}
                    disabled={!canPublish}
                  >
                    {submitButtonLabel}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── publishing mode ─────────────────────────────────── */}
        {dialogMode === "publishing" && (
          <PublishOverlay
            currentStep={currentStep}
            completedSteps={completedSteps}
            elapsedSeconds={elapsedSeconds}
            onCancel={() => {
              cancelledRef.current = true;
              onClose();
            }}
          />
        )}

        {/* ── success mode ────────────────────────────────────── */}
        {dialogMode === "success" && resultUrl && (
          <PublishSuccess
            url={resultUrl}
            elapsedSeconds={elapsedSeconds}
            target={target}
            copyState={copyState}
            onCopy={handleCopyUrl}
            onOpen={handleOpenUrl}
            onPublishAgain={handleRetry}
            onClose={onClose}
          />
        )}

        {/* ── error mode ──────────────────────────────────────── */}
        {dialogMode === "error" && (
          <PublishError
            error={resultError ?? "unknown"}
            elapsedSeconds={elapsedSeconds}
            onRetry={handleRetry}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ─── PublishOverlay (publishing state) ─────────────────────────────────

function PublishOverlay({
  currentStep,
  completedSteps,
  elapsedSeconds,
  onCancel,
}: {
  currentStep: PublishStep | null;
  completedSteps: PublishStep[];
  elapsedSeconds: number;
  onCancel: () => void;
}) {
  const { t, tf } = useT();
  return (
    <>
      <p className="publish-dialog__sub">{t("publish.publishing.sub")}</p>
      <div className="publish-dialog__progress-panel" role="status" aria-live="polite">
        <ul className="publish-dialog__step-list">
          {PUBLISH_STEPS.map((step) => {
            const isDone = completedSteps.includes(step);
            const isCurrent = !isDone && currentStep === step;
            const isPending = !isDone && !isCurrent;
            const cls = isDone ? "is-done" : isCurrent ? "is-current" : "is-pending";
            return (
              <li key={step} className={`publish-dialog__step ${cls}`}>
                <span className="publish-dialog__step-icon" aria-hidden>
                  {isDone ? "✓" : isCurrent ? "" : ""}
                </span>
                <span className="publish-dialog__step-label">
                  {t(`publish.step.${step}`)}
                </span>
                {isCurrent && (
                  <span className="publish-dialog__step-elapsed">
                    {tf("publish.step.elapsed", elapsedSeconds)}
                  </span>
                )}
                {isPending && <span className="publish-dialog__step-elapsed" />}
              </li>
            );
          })}
        </ul>
        <div className="publish-dialog__progress-bar" aria-hidden>
          <div className="publish-dialog__progress-bar-fill" />
        </div>
        <p className="publish-dialog__progress-elapsed">
          {tf("publish.elapsed.label", elapsedSeconds)}
        </p>
      </div>
      <div className="publish-dialog__footer">
        <button
          className="df-btn df-btn--secondary"
          onClick={onCancel}
        >
          {t("publish.cancel")}
        </button>
      </div>
    </>
  );
}

// ─── PublishSuccess ────────────────────────────────────────────────────

function PublishSuccess({
  url,
  elapsedSeconds,
  target,
  copyState,
  onCopy,
  onOpen,
  onPublishAgain,
  onClose,
}: {
  url: string;
  elapsedSeconds: number;
  target: "preview" | "production";
  copyState: "idle" | "copied";
  onCopy: () => void;
  onOpen: () => void;
  onPublishAgain: () => void;
  onClose: () => void;
}) {
  const { t, tf } = useT();
  return (
    <>
      <p className="publish-dialog__sub">
        {target === "production"
          ? t("publish.success.message.prod")
          : t("publish.success.message.preview")}
      </p>
      <div className="publish-dialog__success-card">
        <div className="publish-dialog__success-icon" aria-hidden>✓</div>
        <div className="publish-dialog__success-url-row">
          <a
            className="publish-dialog__success-url"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {url.replace(/^https?:\/\//, "")}
          </a>
        </div>
        <div className="publish-dialog__success-actions">
          <button
            type="button"
            className="df-btn df-btn--secondary"
            onClick={onCopy}
          >
            {copyState === "copied"
              ? t("publish.actions.copied")
              : t("publish.actions.copy_url")}
          </button>
          <button
            type="button"
            className="df-btn df-btn--secondary"
            onClick={onOpen}
          >
            {t("publish.actions.open")}
          </button>
        </div>
      </div>
      <p className="publish-dialog__success-meta">
        {tf("publish.success.elapsed", elapsedSeconds)}
      </p>
      <div className="publish-dialog__footer">
        <button
          className="df-btn df-btn--secondary"
          onClick={onClose}
        >
          {t("publish.actions.close")}
        </button>
        <button
          className="df-btn df-btn--primary"
          onClick={onPublishAgain}
        >
          {t("publish.actions.publish_again")}
        </button>
      </div>
    </>
  );
}

// ─── PublishError ──────────────────────────────────────────────────────

function PublishError({
  error,
  elapsedSeconds,
  onRetry,
  onClose,
}: {
  error: string;
  elapsedSeconds: number;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t, tf } = useT();
  return (
    <>
      <p className="publish-dialog__sub">
        {tf("publish.error.elapsed", elapsedSeconds)}
      </p>
      <div className="publish-dialog__error-card" role="alert">
        <div className="publish-dialog__error-icon" aria-hidden>×</div>
        <div className="publish-dialog__error-body">
          <strong>{t("publish.error.label")}</strong>
          <pre className="publish-dialog__error-message">{error}</pre>
        </div>
      </div>
      <div className="publish-dialog__footer">
        <button
          className="df-btn df-btn--secondary"
          onClick={onClose}
        >
          {t("publish.actions.close")}
        </button>
        <button
          className="df-btn df-btn--primary"
          onClick={onRetry}
        >
          {t("publish.actions.retry")}
        </button>
      </div>
    </>
  );
}

// Suppress unused-state-import warning for VercelDeploymentState.
export type { VercelDeploymentState };
