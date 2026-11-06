# Session 012

## — Phone and iPad reader, Phase 0 spike (2026-11-06)

- Owner: a phone/iPad reading app, a PWA built with react-native-web, easy to read, an Ask-tutor button,
  no notes. Plan: Vite + react-native-web app in `mobile/`, served at `/m/` by the same nginx; phases
  0 spike, 1 read, 2 rich content, 3 tutor, 4 PWA (offline, install), 5 ship. iPad: layout by window
  width (<700 one column, 700-1023 wide column + sheet, >=1024 three panes with docked tutor).
- Design canvas approved: https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS (6 iPhone, 2 iPad screens).
- Spike (feature reader-pwa-spike): library from /api/courses and a streamed tutor reply, verified in
  WebKit at 390x844 and 820x1180 against the Mac mini. Tutor runs on `@copilotkit/core` + `mobile/src/tutor.ts`
  (react-core's v2 entry bundles its chat UI: 700 KB gzipped vs 278 KB). See DECISIONS.md 2026-11-06.
- Found: tutor replies carry citation markers like `[6]`; Phase 3 must turn them into chapter links.
- Phase 1 (feature reader-pwa-read, plan reader-pwa-read.feature-plan.json): library with Continue card,
  outline, chapter reader (markdown-it tokens to our own RN blocks, Key idea callouts, sideways-scrolling
  code), reading settings (size, theme dark/light/sepia, serif/sans, spacing; localStorage), own History-API
  router under /m. Progress: started on first open, finished at the end, each sent once (the server
  overwrites finishedAt on every call). Node 26's global localStorage hides jsdom's: tests stub it.
- Phase 2 (reader-pwa-rich): diagrams (rows that open on phones, open from 700 px; Flowmovie mounted in a
  plain child div because react-native-web rewrites a View's classes; Mermaid lazy) and a one-at-a-time quiz
  that writes answers into the cached chapter. vite.mobile.config.ts serves the shared public/ under /m/.
- Phase 3 (reader-pwa-tutor): tutor sheet (<1024 px, sizes to content) or docked pane; paragraph tap; [n]
  citations link to the latest search's hit; one conversation per chapter in localStorage. The picked paragraph
  is cleared only after the run ends (the run reads context after an await); titles go in the context too.
