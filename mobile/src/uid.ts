/**
 * Random ids that work on any page. `crypto.randomUUID` exists only on secure (https) pages, and the
 * reader is also opened over plain http inside the tailnet (http://coursewright:8080); there it is
 * undefined and calling it crashed the tutor. `getRandomValues` works everywhere.
 */

/** The browser's own randomUUID, captured before `installRandomUUID` can put ours in its place. */
const native: (() => string) | null =
  typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID.bind(globalThis.crypto) : null;

/** A version-4 UUID from getRandomValues, for pages without randomUUID. */
export function fallbackUid(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Never look `crypto.randomUUID` up at call time: after `installRandomUUID` it is this very function's
 * fallback, and an earlier version that did so called itself forever and froze the page over http.
 */
export function uid(): string {
  return native ? native() : fallbackUid();
}

/** Libraries the reader loads (CopilotKit) call `crypto.randomUUID` themselves; give http pages one. */
export function installRandomUUID() {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (!c || typeof c.randomUUID === 'function') return;
  try {
    Object.defineProperty(c, 'randomUUID', { value: fallbackUid, configurable: true, writable: true });
  } catch {
    // A locked-down crypto object: our own code uses uid() and still works.
  }
}
