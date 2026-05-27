import { useEffect, useMemo, useState } from "react";
import { fetchOllamaModels } from "@/lib/ollama-bridge";
import { fetchOpenrouterModels } from "@/lib/openrouter-bridge";
import type { ProviderId } from "./types";

// Per-provider model lists. Each provider exposes its own canonical ids;
// the user picks one from the matching dropdown. Codex doesn't expose
// a `models` subcommand — these are the well-known ids accepted by
// `codex exec --model X`.

export interface ModelOption {
  id: string;
  label: string;
  sub: string;
}

export const CLAUDE_MODEL_OPTIONS: ModelOption[] = [
  { id: "opus",   label: "opus 4.7",   sub: "max quality" },
  { id: "sonnet", label: "sonnet 4.6", sub: "balanced" },
  { id: "haiku",  label: "haiku 4.5",  sub: "fastest" },
];

// Codex CLI doesn't expose `models` subcommand — these are IDs from
// OpenAI's public catalog that codex accepts via `--model X`. Access
// depends on the user's ChatGPT/OpenAI plan. If a model isn't in the
// user's plan, OpenAI returns an error at request time.
// Conservative list: only IDs confirmed shipped publicly. Use Custom
// model input for anything else (e.g. private Codex tiers).
export const CODEX_MODEL_OPTIONS: ModelOption[] = [
  { id: "default",     label: "default",      sub: "from codex CLI config" },
  { id: "gpt-5",       label: "gpt-5",        sub: "OpenAI · flagship" },
  { id: "gpt-4.1",     label: "gpt-4.1",      sub: "OpenAI · code" },
  { id: "gpt-4o",      label: "gpt-4o",       sub: "OpenAI · multimodal" },
  { id: "o3",          label: "o3",           sub: "OpenAI · reasoning" },
  { id: "o3-mini",     label: "o3-mini",      sub: "OpenAI · fast reasoning" },
];

// Gemini CLI accepts model ids per Google's catalog. Access depends on
// the user's tier (free key vs. paid). 2.5 family requires paid in some
// regions; 1.5 family is broadly available on free tier. If a pick errors
// with "no access", fall back to `default` (CLI config) or 1.5-flash.
// Updated 2026-05-15: user asked for gemini-3.1-flash-lite. The 3.1
// family shipped May 2026 (preview). Pricing for 3.1-flash-lite is
// $0.25 in / $1.50 out per 1M; 2.5-flash-lite stays as the GA fallback
// at $0.10/$0.40 with reliable free-tier quota.
export const GEMINI_MODEL_OPTIONS: ModelOption[] = [
  { id: "default",                  label: "default",                  sub: "from gemini CLI config (safest)" },
  { id: "gemini-3.1-flash-lite",    label: "gemini-3.1-flash-lite",    sub: "preview · newest · paid" },
  { id: "gemini-2.5-flash-lite",    label: "gemini-2.5-flash-lite",    sub: "GA · cheapest · free tier" },
  { id: "gemini-2.5-pro",           label: "gemini-2.5-pro",           sub: "max quality · paid" },
  { id: "gemini-2.5-flash",         label: "gemini-2.5-flash",         sub: "fast · paid tier" },
  { id: "gemini-1.5-flash",         label: "gemini-1.5-flash",         sub: "older · widely available" },
];

export const ANTHROPIC_API_MODEL_OPTIONS: ModelOption[] = [
  { id: "default",                   label: "default",                sub: "sonnet 4.6" },
  { id: "claude-opus-4-7",           label: "opus 4.7",               sub: "max quality" },
  { id: "claude-sonnet-4-6",         label: "sonnet 4.6",             sub: "balanced" },
  { id: "claude-haiku-4-5-20251001", label: "haiku 4.5",              sub: "fastest" },
];

// OpenAI API (BYOK) — uses the OpenAI HTTP API directly. Same shipped
// catalog as the Codex CLI accepts; copied here so the picker can render
// the right list when the provider is `openai` instead of inheriting
// the Claude fallback.
export const OPENAI_API_MODEL_OPTIONS: ModelOption[] = [
  { id: "default", label: "default", sub: "gpt-5 (auto)" },
  { id: "gpt-5",      label: "gpt-5",      sub: "OpenAI · flagship" },
  { id: "gpt-4.1",    label: "gpt-4.1",    sub: "OpenAI · code" },
  { id: "gpt-4o",     label: "gpt-4o",     sub: "OpenAI · multimodal" },
  { id: "gpt-4o-mini",label: "gpt-4o-mini",sub: "OpenAI · cheap" },
  { id: "o3",         label: "o3",         sub: "OpenAI · reasoning" },
  { id: "o3-mini",    label: "o3-mini",    sub: "OpenAI · fast reasoning" },
];

// Gemini API (BYOK) — reuses the Gemini CLI catalog; same model ids
// work over the public Generative Language API. Without this entry the
// picker fell back to the Claude list when the provider was `gemini-api`,
// surfacing opus/sonnet/haiku when the user expected gemini-2.5/3.1.
export const GEMINI_API_MODEL_OPTIONS: ModelOption[] = GEMINI_MODEL_OPTIONS;

// Ollama models are pulled by the user (`ollama pull llama3.2`). The picker
// fetches the live list from the Ollama server via /ollama/models — these
// constants are fallbacks for when the probe hasn't run yet.
export const OLLAMA_MODEL_OPTIONS: ModelOption[] = [
  { id: "llama3.2",       label: "llama3.2",       sub: "Meta · 3B / 8B" },
  { id: "qwen2.5-coder",  label: "qwen2.5-coder",  sub: "Alibaba · code" },
  { id: "mistral",        label: "mistral",        sub: "Mistral 7B" },
];

// OpenRouter has 200+ models. The picker fetches the live list via
// /openrouter/models — these constants are fallbacks for when the probe
// hasn't run yet. Default 2026-05-15 = google/gemini-2.5-flash-lite —
// cheapest reliable model in catalog ($0.10/$0.40 per 1M, 1M ctx, no
// free-tier 429 surprises).
export const OPENROUTER_MODEL_OPTIONS: ModelOption[] = [
  { id: "google/gemini-2.5-flash-lite",           label: "Gemini 2.5 Flash-Lite", sub: "Google · cheapest paid" },
  { id: "google/gemini-2.5-flash",                label: "Gemini 2.5 Flash",      sub: "Google · balanced" },
  { id: "anthropic/claude-3.5-sonnet",            label: "Claude 3.5 Sonnet",     sub: "Anthropic · paid" },
  { id: "openai/gpt-4o-mini",                     label: "GPT-4o mini",           sub: "OpenAI · cheap" },
  { id: "deepseek/deepseek-v3.2",                 label: "DeepSeek V3.2",         sub: "DeepSeek · cheap" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)",  sub: "Meta · free tier" },
];

// opencode routes through its own provider config — model id format is
// `provider/model-id`. Each requires a corresponding API key configured
// inside opencode (~/.config/opencode/auth.json). Conservative list of
// public, shipping models. Custom input is the safety valve.
// opencode 1.15+: model id format is provider/model. Catalog depends
// on which auth credentials the user added via `opencode auth login`.
// Default = openai/gpt-5.4-mini-fast (cheapest + ChatGPT-OAuth-safe).
// Users with Anthropic / OpenRouter creds can pick those families.
export const OPENCODE_MODEL_OPTIONS: ModelOption[] = [
  { id: "default",                       label: "default",                 sub: "openai/gpt-5.4-mini-fast" },
  { id: "openai/gpt-5.4-mini-fast",      label: "GPT-5.4 mini fast",       sub: "OpenAI · cheapest" },
  { id: "openai/gpt-5.4-mini",           label: "GPT-5.4 mini",            sub: "OpenAI · cheap" },
  { id: "openai/gpt-5.4",                label: "GPT-5.4",                 sub: "OpenAI · balanced" },
  { id: "openai/gpt-5.5",                label: "GPT-5.5",                 sub: "OpenAI · flagship" },
  { id: "openai/gpt-5.3-codex",          label: "GPT-5.3 codex",           sub: "OpenAI · code" },
  { id: "anthropic/claude-opus-4-7",     label: "Claude 4.7 Opus",         sub: "Anthropic · max" },
  { id: "anthropic/claude-sonnet-4-6",   label: "Claude 4.6 Sonnet",       sub: "Anthropic · balanced" },
];

// Kimi Code via Moonshot AI Platform (OpenAI-compatible). Models listed
// here are conservative — Moonshot's API accepts more identifiers but
// these are the publicly-documented coding-focused ones. Custom model
// input is the safety valve for newer releases (e.g. kimi-k2.6 once
// generally available).
export const KIMI_MODEL_OPTIONS: ModelOption[] = [
  { id: "default",              label: "default",       sub: "kimi-latest (auto-pick)" },
  { id: "kimi-latest",          label: "kimi-latest",   sub: "Moonshot · auto-routed" },
  { id: "kimi-k2-0905-preview", label: "kimi-k2",       sub: "Moonshot · coding-focused" },
  { id: "moonshot-v1-32k",      label: "moonshot-v1-32k", sub: "Moonshot · 32k ctx" },
  { id: "moonshot-v1-128k",     label: "moonshot-v1-128k", sub: "Moonshot · 128k ctx" },
];

export function getModelsForProvider(id: ProviderId): ModelOption[] {
  if (id === "codex") return CODEX_MODEL_OPTIONS;
  if (id === "gemini") return GEMINI_MODEL_OPTIONS;
  if (id === "gemini-api") return GEMINI_API_MODEL_OPTIONS;
  if (id === "anthropic") return ANTHROPIC_API_MODEL_OPTIONS;
  if (id === "openai") return OPENAI_API_MODEL_OPTIONS;
  if (id === "ollama") return OLLAMA_MODEL_OPTIONS;
  if (id === "openrouter") return OPENROUTER_MODEL_OPTIONS;
  if (id === "opencode") return OPENCODE_MODEL_OPTIONS;
  if (id === "kimi") return KIMI_MODEL_OPTIONS;
  return CLAUDE_MODEL_OPTIONS;
}

/** First model in the list — used as the reset target when switching providers. */
export function defaultModelForProvider(id: ProviderId): string {
  const list = getModelsForProvider(id);
  return list[0]?.id ?? "";
}

/** localStorage key used to remember the last-selected model per provider. */
export function lastModelKey(id: ProviderId): string {
  return `df:last-model:${id}`;
}

/** Read the persisted last-selected model for a provider, if any. */
export function readLastModel(id: ProviderId): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(lastModelKey(id)) : null;
  } catch { return null; }
}

/** Persist the last-selected model for a provider. */
export function writeLastModel(id: ProviderId, model: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(lastModelKey(id), model);
  } catch {}
}

/** Live model list with fallback to static catalog.
 *  - ollama: probes the local ollama server for actually-pulled models
 *  - openrouter: fetches the public model catalog (200+)
 *  - anything else: returns the static catalog
 *
 *  Live results win over static when the probe succeeds and returns rows.
 *  On failure or empty list, the static fallback is used so the picker
 *  never goes blank. */
export function useLiveModelOptions(provider: ProviderId): {
  options: ModelOption[];
  loading: boolean;
  source: "live" | "static";
} {
  const [live, setLive] = useState<ModelOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (provider !== "ollama" && provider !== "openrouter") {
      setLive(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = provider === "ollama" ? await fetchOllamaModels() : await fetchOpenrouterModels();
        if (cancelled) return;
        // Probe returns { id, sub } — promote to ModelOption (label = id).
        const opts: ModelOption[] = rows.map((r) => ({ id: r.id, label: r.id, sub: r.sub }));
        setLive(opts.length > 0 ? opts : null);
      } catch {
        if (!cancelled) setLive(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [provider]);

  // Memoize the return value so consumers don't see a fresh object reference
  // on every parent re-render (e.g. while user types in chat input — the
  // EditorScreen re-renders on every keystroke). Without this, downstream
  // useMemo/useEffect deps that include the destructured options/source
  // invalidate every render and can cascade into perceptible UI flicker.
  return useMemo(() => {
    if (live && live.length > 0) {
      return { options: live, loading, source: "live" as const };
    }
    return { options: getModelsForProvider(provider), loading, source: "static" as const };
  }, [live, loading, provider]);
}
