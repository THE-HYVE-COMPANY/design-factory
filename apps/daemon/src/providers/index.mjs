// Provider registry — single source of truth for the dispatcher.
//
// To add a new provider+: drop a new file in this directory
// implementing the ProviderAdapter contract (see types.mjs), then add
// it to PROVIDERS below. The dispatcher in apps/daemon/src/index.mjs
// auto-routes /<id>/stream and /<id>/once.
//
// Order matters for `listProviders()` — it's the order the UI will
// show them by default. V1 beta roster (10 adapters): CLIs first
// (claude, codex, gemini, opencode, kimi), then APIs (anthropic,
// openai, gemini-api, openrouter), then local (ollama).
//
// History: 2026-05-15 cleanup dropped cursor, copilot, qwen, deepseek
// (subscription-gated / niche). crush + aider never shipped as wired
// adapters and the files were also removed.
//
// @file providers/index.mjs

import claude from "./claude.mjs";
import codex from "./codex.mjs";
import gemini from "./gemini.mjs";
import opencode from "./opencode.mjs";
import kimi from "./kimi.mjs";
import anthropic from "./anthropic.mjs";
import openai from "./openai.mjs";
import geminiApi from "./gemini-api.mjs";
import openrouter from "./openrouter.mjs";
import ollama from "./ollama.mjs";

/**
 * @type {Record<string, import("./types.mjs").ProviderAdapter>}
 */
export const PROVIDERS = {
  // CLI providers
  claude,
  codex,
  gemini,
  opencode,
  // API providers (BYOK token)
  kimi,
  anthropic,
  openai,
  "gemini-api": geminiApi,
  openrouter,
  // Local server
  ollama,
};

/**
 * Lookup by id. Returns null when unknown — callers MUST handle that
 * (don't trust frontend-supplied ids).
 *
 * @param {string} id
 * @returns {import("./types.mjs").ProviderAdapter | null}
 */
export function getProvider(id) {
  if (typeof id !== "string") return null;
  return PROVIDERS[id] || null;
}

/**
 * Iterable list. Used by the dispatch loop and by GET /providers.
 *
 * @returns {import("./types.mjs").ProviderAdapter[]}
 */
export function listProviders() {
  return Object.values(PROVIDERS);
}

/**
 * Public-shape descriptor for /providers and /providers/:id. Strips
 * the function references — those leak the closure scope and have no
 * value over the wire.
 *
 * descriptor includes optional `available` field when the
 * dispatcher injects detection state. Adapter modules don't compute
 * availability themselves (no async work in the registry); the
 * /providers endpoint augments the description with PATH probes for
 * CLIs and token presence for APIs.
 *
 * @param {import("./types.mjs").ProviderAdapter} p
 */
export function describeProvider(p) {
  return {
    id: p.id,
    label: p.label,
    capabilities: p.capabilities,
    // readiness badge. Adapters opt in by setting `readiness:` on
    // their default export; missing values fall back to "experimental"
    // (conservative — assume unverified until proven).
    readiness: p.readiness || "experimental",
  };
}
