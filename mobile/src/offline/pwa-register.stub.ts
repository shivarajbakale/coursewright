/** Tests run without vite-plugin-pwa, so its virtual module is this stand-in (see vite.config.ts `test.alias`). */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => {};
}
