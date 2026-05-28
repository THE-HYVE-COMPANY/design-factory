import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { persistOrRecoverTurn } from "./chat-persist";
import { readRecovery } from "./chat-recovery";
import type { Turn } from "./chat-turns";

const sampleTurn: Turn = {
  id: "t-persist-1",
  ts: 1_700_000_000_000,
  user: { text: "ping", attachments: [] },
  ai: null,
};

const installFetch = (impl: typeof fetch): void => {
  globalThis.fetch = impl as typeof fetch;
};

describe("persistOrRecoverTurn — durable write with bounded latency", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns saved when the daemon write resolves within the timeout", async () => {
    installFetch(async () => new Response("{}", { status: 200 }));
    const promise = persistOrRecoverTurn("slug", "p1", "thread", sampleTurn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.status).toBe("saved");
    expect(result.reason).toBe("ok");
    // Nothing in recovery — daemon owns the turn.
    expect(readRecovery("p1", "thread")).toHaveLength(0);
  });

  it("returns recovered when the daemon write times out", async () => {
    // Daemon never responds.
    installFetch(() => new Promise(() => {}));
    const promise = persistOrRecoverTurn("slug", "p1", "thread", sampleTurn, {
      timeoutMs: 200,
    });
    await vi.advanceTimersByTimeAsync(250);
    const result = await promise;
    expect(result.status).toBe("recovered");
    expect(result.reason).toBe("timeout");
    const recovered = readRecovery("p1", "thread");
    expect(recovered).toHaveLength(1);
    expect(recovered[0].turn.id).toBe("t-persist-1");
    expect(recovered[0].reason).toBe("timeout");
  });

  it("returns recovered when the daemon write returns HTTP 500", async () => {
    installFetch(async () => new Response("boom", { status: 500 }));
    const promise = persistOrRecoverTurn("slug", "p1", "thread", sampleTurn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.status).toBe("recovered");
    expect(result.reason).toBe("http-fail");
    expect(readRecovery("p1", "thread")).toHaveLength(1);
  });

  it("returns recovered with reason no-slug when projectSlug is missing — daemon never called", async () => {
    const fetchSpy = vi.fn();
    installFetch(fetchSpy as typeof fetch);
    const promise = persistOrRecoverTurn(null, "p1", "thread", sampleTurn);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.status).toBe("recovered");
    expect(result.reason).toBe("no-slug");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readRecovery("p1", "thread")).toHaveLength(1);
  });

  it("returns failed when both daemon AND localStorage are unavailable", async () => {
    installFetch(async () => new Response("nope", { status: 500 }));
    // Mock localStorage as throwing on every operation.
    const orig = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });
    try {
      const promise = persistOrRecoverTurn("slug", "p1", "thread", sampleTurn);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.status).toBe("failed");
      expect(result.reason).toBe("http-fail");
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: orig,
      });
    }
  });

  it("respects custom timeoutMs (proves the knob is wired through)", async () => {
    installFetch(() => new Promise(() => {}));
    const promise = persistOrRecoverTurn("slug", "p1", "thread", sampleTurn, {
      timeoutMs: 50,
    });
    await vi.advanceTimersByTimeAsync(60);
    const result = await promise;
    expect(result.status).toBe("recovered");
    expect(result.reason).toBe("timeout");
  });
});
