/**
 * Random ids that work on any page. `crypto.randomUUID` exists only on secure (https) pages, and the
 * reader is also opened over plain http inside the tailnet (http://coursewright:8080); there it is
 * undefined and calling it crashed the tutor. `getRandomValues` works everywhere.
 */
export function uid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Libraries the reader loads (CopilotKit) call `crypto.randomUUID` themselves; give http pages one. */
export function installRandomUUID() {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (!c || typeof c.randomUUID === 'function') return;
  try {
    Object.defineProperty(c, 'randomUUID', { value: uid, configurable: true, writable: true });
  } catch {
    // A locked-down crypto object: our own code uses uid() and still works.
  }
}
