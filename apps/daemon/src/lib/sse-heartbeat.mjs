// SSE heartbeat — keep long-running provider streams alive.
//
// Some providers (notably kimi-cli) don't stream JSONL incrementally —
// they buffer the full turn output and emit at the end. During the
// buffering window the SSE connection is silent, and any intermediate
// timeout (curl --max-time, browser request idle, proxy) tears it down
// before the canonical events arrive. The file lands on disk via the
// CLI's native tool layer, but the UI never sees Write/Edit/done.
//
// Fix: emit `event: ping\ndata: {"t":<ms>}\n\n` every PING_INTERVAL_MS
// once the adapter sets Content-Type: text/event-stream. The wrap is
// transparent — armHeartbeat() intercepts writeHead/end on the existing
// res object, no adapter changes required.
//
// Frontend: pings are ignored by the SSE consumer (useClaude.ts parses
// known events only; unknown event types are dropped). Adding an
// explicit "ping" handler would be cleaner long-term but isn't needed
// for the fix — the goal is just keeping the connection alive.

const DEFAULT_INTERVAL_MS = 20000;

/**
 * Arm SSE heartbeat on a response object.
 *
 * Wraps res.writeHead and res.end so that once a text/event-stream
 * response is started, a setInterval emits `event: ping` every
 * intervalMs. Cleared on res.end() OR req close.
 *
 * Idempotent — safe to call multiple times on the same res.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} intervalMs default 20000ms (20s)
 */
export function armHeartbeat(req, res, intervalMs = DEFAULT_INTERVAL_MS) {
  if (res.__heartbeatArmed) return; // idempotent
  res.__heartbeatArmed = true;

  let timer = null;
  const isStream = (headers) => {
    if (!headers) return false;
    const ct = headers["Content-Type"] ?? headers["content-type"];
    return typeof ct === "string" && ct.toLowerCase().includes("event-stream");
  };

  const clear = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const tick = () => {
    if (res.writableEnded || res.destroyed) {
      clear();
      return;
    }
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    } catch {
      clear();
    }
  };

  const arm = () => {
    clear();
    timer = setInterval(tick, intervalMs);
    // Don't keep the process alive solely for heartbeats.
    if (typeof timer.unref === "function") timer.unref();
  };

  // Intercept writeHead — only arm when content-type marks SSE.
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode, ...rest) {
    let headers = null;
    if (rest.length === 1 && typeof rest[0] === "object") headers = rest[0];
    else if (rest.length === 2 && typeof rest[1] === "object") headers = rest[1];
    const result = origWriteHead(statusCode, ...rest);
    if (isStream(headers)) arm();
    return result;
  };

  // Intercept end — clear timer.
  const origEnd = res.end.bind(res);
  res.end = function (...args) {
    clear();
    return origEnd(...args);
  };

  // Clear on client disconnect.
  req.on("close", clear);
  req.on("aborted", clear);
}
