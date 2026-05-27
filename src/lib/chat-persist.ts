// chat-persist.ts — durable turn write with bounded latency + local fallback.
//
// Audit verdict 2026-05-08 Fase 1 #4 follow-up + #5: handleSend must not
// invoke the provider before the user turn is durable somewhere. PR #108
// landed the ordering ("appendChatTurn before provider stream") but kept
// the call as fire-and-forget — a tab close in the first ~50ms still lost
// the turn. Auditor blocked declaring P0 resolved until this layer exists.
//
// Contract:
//
//   await persistOrRecoverTurn(slug, projectId, threadId, turn)
//     → { status: "saved" | "recovered" | "failed", reason?: string }
//
// Behavior:
//
//   1. Race appendChatTurn against a configurable timeout (default 500ms).
//   2. If the daemon write resolves within the window with `true` → "saved".
//   3. Any failure path (timeout, http error, exception, missing slug) →
//      mirror the turn into localStorage via chat-recovery and return
//      "recovered". The pending daemon promise keeps running in the
//      background; parseChatJsonl dedupes the eventual duplicate write.
//   4. If localStorage is also unavailable (iframe sandbox, private mode)
//      → "failed". Caller surfaces a fatal toast.
//
// The timeout is the critical knob. Too short and a healthy daemon's
// jitter pushes turns into the recovery layer needlessly; too long and a
// hung daemon blocks the chat input. 500ms covers a healthy localhost
// roundtrip (typically <20ms) with comfortable headroom.

import { appendChatTurn } from "./claude-bridge";
import { saveRecovery, isRecoveryStorageAvailable, type RecoveryReason } from "./chat-recovery";
import { surfaceError } from "./error-surface";
import type { Turn } from "./chat-turns";

export type PersistStatus = "saved" | "recovered" | "failed";

export interface PersistResult {
  status: PersistStatus;
  reason?: RecoveryReason | "ok";
}

export interface PersistOptions {
  /** Hard ceiling for the daemon write before falling back to local
   *  recovery. Default 500ms. Auditor recommendation: 300–700ms. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 500;

const TIMEOUT_SENTINEL = Symbol("persist-timeout");

function delay(ms: number): Promise<typeof TIMEOUT_SENTINEL> {
  return new Promise((resolve) => setTimeout(() => resolve(TIMEOUT_SENTINEL), ms));
}

export async function persistOrRecoverTurn(
  projectSlug: string | null | undefined,
  projectId: string | null | undefined,
  threadId: string,
  turn: Turn,
  opts: PersistOptions = {},
): Promise<PersistResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const recoverWith = (reason: RecoveryReason): PersistResult => {
    const ok = saveRecovery(projectId, threadId, projectSlug ?? null, turn, reason);
    if (!ok) {
      surfaceError(
        new Error(`recovery storage unavailable (${reason})`),
        "persistOrRecoverTurn",
        "error",
      );
      return { status: "failed", reason: "no-storage" };
    }
    return { status: "recovered", reason };
  };

  // Project slug missing — daemon write would no-op, so go straight to
  // local recovery. Auditor flagged the earlier silent no-op as the
  // single point of failure that broke the "3D" repro.
  if (!projectSlug) {
    return recoverWith("no-slug");
  }

  // Storage unavailable AND we're about to attempt a daemon write — we
  // still try the daemon, but the recovery fallback can't catch us.
  // This is a "best effort daemon, nothing else" mode; if the daemon
  // also fails the chat is lost. Surface the warning so the user sees
  // it before they lose data.
  const recoveryAvailable = isRecoveryStorageAvailable();

  let daemonPromise: Promise<boolean>;
  try {
    daemonPromise = appendChatTurn(projectSlug, threadId, turn);
  } catch (e) {
    // Synchronous throw (rare — fetch usually rejects async).
    if (!recoveryAvailable) {
      surfaceError(e, "persistOrRecoverTurn[sync-throw]", "error");
      return { status: "failed", reason: "exception" };
    }
    return recoverWith("exception");
  }

  const winner = await Promise.race([daemonPromise, delay(timeoutMs)]);

  if (winner === TIMEOUT_SENTINEL) {
    // Daemon still pending. Attach a tail so it doesn't reject silently
    // if it eventually fails — surfaceError is already called inside
    // appendChatTurn for HTTP errors. We just want unhandled-rejection
    // safety here.
    daemonPromise.catch((e) => surfaceError(e, "persistOrRecoverTurn[tail]", "warn"));
    if (!recoveryAvailable) return { status: "failed", reason: "no-storage" };
    return recoverWith("timeout");
  }

  // Daemon resolved within the window.
  if (winner === true) return { status: "saved", reason: "ok" };
  // appendChatTurn returned false (HTTP non-OK or thrown caught inside).
  if (!recoveryAvailable) return { status: "failed", reason: "http-fail" };
  return recoverWith("http-fail");
}
