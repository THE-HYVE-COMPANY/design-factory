// byok-tokens.ts — generic BYOK token helpers for OpenAI + Gemini.
// Mirrors the Anthropic pattern (anthropic-bridge.ts) but parameterised by
// service id so we don't repeat the same fetch boilerplate twice.
//
// Token persistence lives in the daemon (~/.design-factory/{service}.json,
// chmod 600). The browser only ever sees `tokenSet:bool + source` — the
// raw value is never echoed back. Env vars (OPENAI_API_KEY,
// GEMINI_API_KEY / GOOGLE_API_KEY) take precedence over disk.

import { BRIDGE_URL } from "@/lib/claude-bridge";

export type ByokService = "openai" | "gemini";

export interface ByokTokenState {
  tokenSet: boolean;
  source: "env" | "disk" | null;
}

export async function getTokenState(service: ByokService): Promise<ByokTokenState> {
  try {
    const res = await fetch(`${BRIDGE_URL}/config/${service}`);
    if (!res.ok) return { tokenSet: false, source: null };
    return (await res.json()) as ByokTokenState;
  } catch {
    return { tokenSet: false, source: null };
  }
}

export async function saveToken(
  service: ByokService,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BRIDGE_URL}/config/${service}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => null) as any;
    if (!res.ok) return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
