// Unit tests for SSE heartbeat helper.
//
// Validates the wrap is idempotent, only arms on text/event-stream,
// emits pings at the configured interval, and clears on end/close.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { armHeartbeat } from "./sse-heartbeat.mjs";
import { EventEmitter } from "node:events";

function mockRes() {
  const writes = [];
  const res = {
    writeHead: vi.fn((_status, _headers) => res),
    write: vi.fn((chunk) => {
      writes.push(chunk);
      return true;
    }),
    end: vi.fn(),
    writableEnded: false,
    destroyed: false,
  };
  res.writes = writes;
  return res;
}

function mockReq() {
  const req = new EventEmitter();
  return req;
}

describe("armHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not emit pings before writeHead", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    vi.advanceTimersByTime(5000);
    expect(res.writes.length).toBe(0);
  });

  it("does not emit pings when content-type is not event-stream", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    res.writeHead(200, { "Content-Type": "application/json" });
    vi.advanceTimersByTime(5000);
    expect(res.writes.length).toBe(0);
  });

  it("emits pings every interval once SSE content-type is set", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    vi.advanceTimersByTime(3500);
    // Should have emitted 3 pings (at 1s, 2s, 3s — not at 3.5s yet)
    expect(res.writes.length).toBe(3);
    res.writes.forEach((w) => {
      expect(w).toMatch(/^event: ping\ndata: \{"t":\d+\}\n\n$/);
    });
  });

  it("handles case-insensitive content-type header", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 500);
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
    vi.advanceTimersByTime(1500);
    expect(res.writes.length).toBe(3);
  });

  it("clears interval on res.end()", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    vi.advanceTimersByTime(2500);
    expect(res.writes.length).toBe(2);
    res.end();
    vi.advanceTimersByTime(5000);
    expect(res.writes.length).toBe(2); // no more pings
  });

  it("clears interval on req close", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    vi.advanceTimersByTime(1500);
    expect(res.writes.length).toBe(1);
    req.emit("close");
    vi.advanceTimersByTime(5000);
    expect(res.writes.length).toBe(1);
  });

  it("clears interval on req aborted", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    vi.advanceTimersByTime(2500);
    req.emit("aborted");
    vi.advanceTimersByTime(5000);
    expect(res.writes.length).toBe(2);
  });

  it("is idempotent — calling twice does not double pings", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    armHeartbeat(req, res, 1000);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    vi.advanceTimersByTime(3500);
    expect(res.writes.length).toBe(3); // 3 pings, not 6
  });

  it("stops pinging when res.writableEnded becomes true", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 500);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    vi.advanceTimersByTime(1000);
    expect(res.writes.length).toBe(2);
    res.writableEnded = true;
    vi.advanceTimersByTime(2000);
    // Next tick fires once more but exits early after seeing writableEnded
    expect(res.writes.length).toBe(2);
  });

  it("preserves writeHead return value", () => {
    const req = mockReq();
    const res = mockRes();
    armHeartbeat(req, res, 1000);
    const ret = res.writeHead(200, { "Content-Type": "text/event-stream" });
    expect(ret).toBe(res);
  });
});
