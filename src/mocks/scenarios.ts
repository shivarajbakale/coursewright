import { http, HttpResponse, passthrough, type RequestHandler } from 'msw';

/**
 * Dev-only mock scenarios, for seeing the states real data rarely shows.
 *
 *   ?mock=empty    every collection is empty (no courses, notes, sources…)
 *   ?mock=fail     every read fails with a 500 and a stock message
 *   ?mock=offline  every read fails the way a proxy with no backend does (502)
 *   ?mock=crash    a course comes back malformed, so the Course page throws
 *   ?mock=demo     the normal mock data with a model connected (no setup banners): for screenshots
 *   ?mock=default  back to the normal mock data
 *
 * The choice is kept in sessionStorage, so it survives navigation in the tab.
 */
export type Scenario = 'default' | 'empty' | 'fail' | 'offline' | 'crash' | 'demo';

const KEY = 'coursewright.mock-scenario';

export function readScenario(): Scenario {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('mock');
    if (fromUrl === 'empty' || fromUrl === 'fail' || fromUrl === 'offline' || fromUrl === 'crash' || fromUrl === 'demo' || fromUrl === 'default') {
      sessionStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(KEY);
    return stored === 'empty' || stored === 'fail' || stored === 'offline' || stored === 'crash' || stored === 'demo' ? stored : 'default';
  } catch {
    return 'default';
  }
}

const ok = <T>(data: T) => HttpResponse.json({ data });

const EMPTY_LISTS = [
  '/api/courses',
  '/api/notes/tree',
  '/api/notes/recent',
  '/api/notes/search',
  '/api/sources',
  '/api/notifications',
];

export function scenarioHandlers(scenario: Scenario): RequestHandler[] {
  if (scenario === 'empty') {
    return [
      ...EMPTY_LISTS.map((path) => http.get(path, () => ok([]))),
      http.get('/api/sources/stats', () => ok({ sources: 0, chunks: 0, courses: 0, embedModel: 'local-hash-1024', dims: 1024, embedder: 'local' })),
      http.post('/api/search/test', () => ok([])),
    ];
  }
  if (scenario === 'fail' || scenario === 'offline') {
    const status = scenario === 'fail' ? 500 : 502;
    // Health stays up so the "no model" banner does not hide the states under test.
    return [
      http.get('/api/health', () => passthroughHealth()),
      // The tutor runtime is not under test; let it through.
      http.get('/api/copilotkit/*', () => passthrough()),
      http.get('/api/*', () => HttpResponse.json({ message: 'An error occurred' }, { status })),
      http.post('/api/search/test', () => HttpResponse.json({ message: 'An error occurred' }, { status })),
    ];
  }
  if (scenario === 'demo') {
    return [
      http.get('/api/health', () =>
        ok({ ok: true, anthropic: true, voyage: true, version: 'mock', model: 'claude-opus-5-5', provider: 'anthropic' })
      ),
    ];
  }
  if (scenario === 'crash') {
    return [http.get('/api/courses/:id', () => ok({ id: 'broken', title: 'Broken', modules: null }))];
  }
  return [];
}

function passthroughHealth() {
  return ok({ ok: true, anthropic: false, voyage: false, version: 'mock', model: 'claude-opus-5-5', provider: 'anthropic' });
}
