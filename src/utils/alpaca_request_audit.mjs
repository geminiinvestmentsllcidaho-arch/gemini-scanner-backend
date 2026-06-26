const DEFAULT_LIMIT = 100;
const AUDIT_FLAG = Symbol.for("gemini.alpacaRequestAuditInstalled");
const ORIGINAL_FETCH = Symbol.for("gemini.originalFetch");

const state = {
  installed: false,
  events: [],
  limit: DEFAULT_LIMIT,
};

function safeUrl(input) {
  try {
    if (typeof input === "string") return new URL(input);
    if (input?.url) return new URL(input.url);
  } catch {}
  return null;
}

function cleanHeaders(headers) {
  const out = {};
  if (!headers) return out;
  try {
    const h = new Headers(headers);
    for (const [k, v] of h.entries()) {
      const key = k.toLowerCase();
      if (key.includes("key") || key.includes("secret") || key.includes("authorization")) continue;
      out[key] = v;
    }
  } catch {}
  return out;
}

function pushEvent(event) {
  state.events.unshift(event);
  state.events = state.events.slice(0, state.limit);
}

export function getAlpacaRequestAudit() {
  return {
    installed: state.installed,
    total: state.events.length,
    recent: state.events.slice(),
  };
}

export function resetAlpacaRequestAudit() {
  state.events = [];
}

export function installAlpacaRequestAudit(options = {}) {
  state.limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : DEFAULT_LIMIT;

  if (globalThis[AUDIT_FLAG]) {
    state.installed = true;
    return getAlpacaRequestAudit();
  }

  if (typeof globalThis.fetch !== "function") {
    state.installed = false;
    return getAlpacaRequestAudit();
  }

  globalThis[ORIGINAL_FETCH] = globalThis.fetch;

  globalThis.fetch = async function auditedFetch(input, init = {}) {
    const url = safeUrl(input);
    const shouldAudit = !!url && /(^|\.)alpaca\.markets$/i.test(url.hostname);

    if (!shouldAudit) {
      return globalThis[ORIGINAL_FETCH](input, init);
    }

    const startedAtMs = Date.now();
    const method = String(init?.method || input?.method || "GET").toUpperCase();

    try {
      const res = await globalThis[ORIGINAL_FETCH](input, init);
      const finishedAtMs = Date.now();

      pushEvent({
        ts: new Date(finishedAtMs).toISOString(),
        ok: res.ok,
        method,
        host: url.hostname,
        path: url.pathname,
        search: url.search,
        status: res.status,
        statusText: res.statusText,
        durationMs: finishedAtMs - startedAtMs,
        requestId: res.headers?.get?.("x-request-id") || null,
        headers: cleanHeaders(init?.headers || input?.headers),
      });

      return res;
    } catch (err) {
      const finishedAtMs = Date.now();

      pushEvent({
        ts: new Date(finishedAtMs).toISOString(),
        ok: false,
        method,
        host: url.hostname,
        path: url.pathname,
        search: url.search,
        status: 0,
        statusText: "FETCH_ERROR",
        durationMs: finishedAtMs - startedAtMs,
        requestId: null,
        error: err?.message || String(err),
        headers: cleanHeaders(init?.headers || input?.headers),
      });

      throw err;
    }
  };

  globalThis[AUDIT_FLAG] = true;
  state.installed = true;
  return getAlpacaRequestAudit();
}
