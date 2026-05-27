// [DEPRECATED] OAuthDeviceFlow — the Vercel + GitHub OAuth UI is not
// part of the current public surface.
//
// File preserved (not deleted) for a future polished surface. No
// component currently imports this. Daemon endpoints
// (/gh/device/*, /vercel/device/*) are also preserved — see
// apps/daemon/src/index.mjs.
//
// === ORIGINAL DOC (kept for future planning) =================================
//
// OAuthDeviceFlow — reusable RFC 8628 device-flow UI.
//
// "nao tem como colocarmos
// oauth de vercel e github pra logar mais facilitado?". This component
// renders the user_code + verify URI, opens the verification URL in a
// new tab, and polls the daemon until the user authorizes (or the code
// expires). On success it fires `onSuccess()`; on cancel/error it fires
// `onCancel()`. The host card decides what to show next.
//
// The component is provider-agnostic — pass functions to start the flow
// and poll for status. GitHub uses ghDeviceStart/Poll (already shipped).
// Vercel uses vercelDeviceStart/Poll which is daemon-gated by
// DF_VERCEL_CLIENT_ID. When the daemon returns HTTP 503 the flow
// surfaces the user-friendly hint and lets the host fall back to
// BYOK paste.
//
// Premium UX (skill: hyve-taste premium_ui_surface + REFINEMENT 10):
//   · Mono code rendered tabular at 32px, letter-spaced, copy on click
//   · Skeu cavity bg with subtle border; respects dark/light tokens
//   · Buttons stick to df-btn flat Geist (no 3D fake — v27b carry-over)
//   · prefers-reduced-motion: no spinner pulse, just static dots
//   · Cancel always available; never blocks on errors

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";

export type DeviceStartResult =
  | { deviceCode: string; userCode: string; verificationUri: string; verificationUriComplete?: string; interval: number; expiresIn: number }
  | { error: string; fallback?: string; hint?: string };

export type DevicePollResult =
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "ok"; tokenType?: string; scope?: string }
  | { status: "error"; error: string };

interface OAuthDeviceFlowProps {
  /** Provider id — drives label copy (github | vercel). */
  provider: "github" | "vercel";
  /** Daemon helper: kick off the device flow and return the user code. */
  startFn: () => Promise<DeviceStartResult>;
  /** Daemon helper: poll for status with the given device code. */
  pollFn: (deviceCode: string) => Promise<DevicePollResult>;
  /** Fired once authorization completes successfully. */
  onSuccess: () => void;
  /** Fired on cancel/error/expire — host re-renders disconnect state. */
  onCancel: () => void;
}

export function OAuthDeviceFlow({ provider, startFn, pollFn, onSuccess, onCancel }: OAuthDeviceFlowProps) {
  const { t, tf } = useT();
  type Stage = "idle" | "starting" | "polling" | "ok" | "error";
  const [stage, setStage] = useState<Stage>("idle");
  const [device, setDevice] = useState<null | { deviceCode: string; userCode: string; verificationUri: string; verificationUriComplete?: string; expiresAt: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cancelledRef = useRef(false);

  // Auto-start when mounted — host already gated this by user click.
  useEffect(() => {
    let active = true;
    cancelledRef.current = false;
    setStage("starting");
    void (async () => {
      const r = await startFn();
      if (!active) return;
      if ("error" in r) {
        setError(r.error);
        setHint(("hint" in r && r.hint) || null);
        setStage("error");
        return;
      }
      setDevice({
        deviceCode: r.deviceCode,
        userCode: r.userCode,
        verificationUri: r.verificationUri,
        verificationUriComplete: r.verificationUriComplete,
        expiresAt: Date.now() + r.expiresIn * 1000,
      });
      setStage("polling");
      // Open verification URL in a new tab so the user lands on the form.
      try { window.open(r.verificationUriComplete || r.verificationUri, "_blank", "noopener"); } catch {}
    })();
    return () => { active = false; };
    // Intentionally only run on mount — startFn identity is stable per host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll loop while polling.
  useEffect(() => {
    if (!device || stage !== "polling") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = 5000;
    const tick = async () => {
      if (cancelledRef.current) return;
      if (Date.now() > device.expiresAt) {
        setError(t("oauth.error.expired"));
        setStage("error");
        return;
      }
      const res = await pollFn(device.deviceCode);
      if (cancelledRef.current) return;
      if (res.status === "ok") {
        setStage("ok");
        // Tiny delay so the user sees the success affordance.
        setTimeout(() => onSuccess(), 600);
        return;
      }
      if (res.status === "error") {
        setError(res.error || t("oauth.error.generic"));
        setStage("error");
        return;
      }
      if (res.status === "slow_down") delay = Math.min(delay + 5000, 30000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => { if (timer) clearTimeout(timer); };
  }, [device, stage, pollFn, t, onSuccess]);

  const handleCancel = () => {
    cancelledRef.current = true;
    onCancel();
  };

  const handleCopyCode = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.userCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const providerLabel = provider === "github" ? "GitHub" : "Vercel";

  return (
    <div className="oauth-device-flow" role="region" aria-label={tf("oauth.region.aria", providerLabel)}>
      {(stage === "starting" || stage === "polling") && device && (
        <>
          <p className="oauth-device-flow__lede">
            {tf("oauth.lede", providerLabel)}
          </p>
          <button
            type="button"
            className="oauth-device-flow__code"
            onClick={handleCopyCode}
            title={t("oauth.code.copy.title")}
            aria-label={tf("oauth.code.aria", device.userCode)}
          >
            {device.userCode}
          </button>
          {copied && (
            <div className="oauth-device-flow__copied">{t("oauth.code.copied")}</div>
          )}
          <div className="oauth-device-flow__actions">
            <a
              href={device.verificationUriComplete || device.verificationUri}
              target="_blank"
              rel="noreferrer"
              className="df-btn df-btn--primary"
            >
              {tf("oauth.open", providerLabel)}
            </a>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={handleCancel}
            >
              {t("oauth.cancel")}
            </button>
            <span className="oauth-device-flow__waiting" aria-live="polite">
              <span className="oauth-device-flow__dots" aria-hidden="true">
                <span /><span /><span />
              </span>
              {t("oauth.waiting")}
            </span>
          </div>
        </>
      )}

      {stage === "starting" && !device && (
        <p className="oauth-device-flow__lede">{tf("oauth.starting", providerLabel)}</p>
      )}

      {stage === "ok" && (
        <p className="oauth-device-flow__success" role="status">
          {tf("oauth.success", providerLabel)}
        </p>
      )}

      {stage === "error" && (
        <div className="oauth-device-flow__error" role="alert">
          <p className="oauth-device-flow__error-msg">
            {error || t("oauth.error.generic")}
          </p>
          {hint && <p className="oauth-device-flow__error-hint">{hint}</p>}
          <button
            type="button"
            className="df-btn df-btn--secondary"
            onClick={handleCancel}
          >
            {t("oauth.dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}
