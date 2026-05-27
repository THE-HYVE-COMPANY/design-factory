import { describe, it, expect, beforeEach } from "vitest";
import {
  recoveryKey,
  saveRecovery,
  readRecovery,
  clearRecovery,
  clearAllRecovery,
  isRecoveryStorageAvailable,
} from "./chat-recovery";
import type { Turn } from "./chat-turns";

const turn = (id: string, text: string): Turn => ({
  id,
  ts: Date.now(),
  user: { text, attachments: [] },
  ai: null,
});

describe("chat-recovery — localStorage roundtrip", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("recoveryKey composes a stable namespace per (project, thread)", () => {
    expect(recoveryKey("p1", "t1")).toBe("df:recovery-chat:p1:t1");
    expect(recoveryKey(null, "t1")).toBe("df:recovery-chat:none:t1");
    expect(recoveryKey(undefined, "t1")).toBe("df:recovery-chat:none:t1");
  });

  it("saveRecovery + readRecovery preserves the turn payload, reason, and slug", () => {
    const t = turn("t-1", "hello");
    expect(saveRecovery("p1", "thread", "slug-1", t, "timeout")).toBe(true);
    const out = readRecovery("p1", "thread");
    expect(out).toHaveLength(1);
    expect(out[0].turn.id).toBe("t-1");
    expect(out[0].turn.user.text).toBe("hello");
    expect(out[0].reason).toBe("timeout");
    expect(out[0].savedAt).toBeGreaterThan(0);
    expect(out[0].slug).toBe("slug-1");
  });

  it("repeated save with the same turn id replaces the prior entry (last write wins)", () => {
    saveRecovery("p1", "thread", "slug-1", turn("t-1", "first"), "timeout");
    saveRecovery("p1", "thread", "slug-1", turn("t-1", "second"), "http-fail");
    const out = readRecovery("p1", "thread");
    expect(out).toHaveLength(1);
    expect(out[0].turn.user.text).toBe("second");
    expect(out[0].reason).toBe("http-fail");
  });

  it("preserves entries across distinct turn ids", () => {
    saveRecovery("p1", "thread", "slug-1", turn("a", "hi"), "timeout");
    saveRecovery("p1", "thread", "slug-1", turn("b", "yo"), "exception");
    const out = readRecovery("p1", "thread");
    expect(out.map((e) => e.turn.id)).toEqual(["a", "b"]);
  });

  it("isolates entries between different threads (and projects)", () => {
    saveRecovery("p1", "thread-a", "slug-1", turn("x", "a-side"), "timeout");
    saveRecovery("p1", "thread-b", "slug-1", turn("x", "b-side"), "timeout");
    saveRecovery("p2", "thread-a", "slug-2", turn("x", "p2-side"), "timeout");
    expect(readRecovery("p1", "thread-a")[0].turn.user.text).toBe("a-side");
    expect(readRecovery("p1", "thread-b")[0].turn.user.text).toBe("b-side");
    expect(readRecovery("p2", "thread-a")[0].turn.user.text).toBe("p2-side");
  });

  it("clearRecovery removes only the matching turn id", () => {
    saveRecovery("p1", "thread", "slug-1", turn("a", "hi"), "timeout");
    saveRecovery("p1", "thread", "slug-1", turn("b", "yo"), "timeout");
    clearRecovery("p1", "thread", "a");
    const out = readRecovery("p1", "thread");
    expect(out).toHaveLength(1);
    expect(out[0].turn.id).toBe("b");
  });

  it("clearRecovery removes the storage key entirely when the last entry leaves", () => {
    saveRecovery("p1", "thread", "slug-1", turn("a", "hi"), "timeout");
    clearRecovery("p1", "thread", "a");
    expect(globalThis.localStorage.getItem(recoveryKey("p1", "thread"))).toBeNull();
  });

  it("clearAllRecovery wipes the namespace", () => {
    saveRecovery("p1", "thread", "slug-1", turn("a", "hi"), "timeout");
    saveRecovery("p1", "thread", "slug-1", turn("b", "yo"), "timeout");
    clearAllRecovery("p1", "thread");
    expect(readRecovery("p1", "thread")).toEqual([]);
  });

  it("readRecovery returns [] for absent keys", () => {
    expect(readRecovery("never-saved", "any")).toEqual([]);
  });

  it("isRecoveryStorageAvailable reflects working localStorage", () => {
    expect(isRecoveryStorageAvailable()).toBe(true);
  });

  it("trims to 200 entries via FIFO when the per-key budget is exceeded", () => {
    for (let i = 0; i < 220; i++) {
      saveRecovery("p1", "thread", "slug-1", turn(`t-${i}`, `msg ${i}`), "timeout");
    }
    const out = readRecovery("p1", "thread");
    expect(out).toHaveLength(200);
    // Oldest 20 dropped.
    expect(out[0].turn.id).toBe("t-20");
    expect(out[199].turn.id).toBe("t-219");
  });
});
