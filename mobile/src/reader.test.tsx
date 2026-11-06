import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RAFT_ID } from '@/mocks/data/raftCourse';
import { App } from './App';
import { layoutFor } from './courseMath';
import { parse } from './router';
import { useSettings } from './settings';

function renderAt(path: string) {
  window.history.pushState(null, '', path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

// Node 26 defines its own global localStorage (empty without --localstorage-file), which hides
// jsdom's; the web app's tests stub it the same way.
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());
afterEach(() => window.history.pushState(null, '', '/'));

describe('reader routes and layout', () => {
  it('parses every reader address under /m', () => {
    expect(parse('/m/')).toEqual({ name: 'library' });
    expect(parse('/m/settings')).toEqual({ name: 'settings' });
    expect(parse('/m/courses/c1')).toEqual({ name: 'course', courseId: 'c1' });
    expect(parse('/m/courses/c1/chapters/ch%201')).toEqual({ name: 'chapter', courseId: 'c1', chapterId: 'ch 1' });
    expect(parse('/m/nope/x')).toEqual({ name: 'missing', path: '/nope/x' });
  });

  it('chooses the layout from the window width', () => {
    expect([320, 699, 700, 1023, 1024, 1366].map(layoutFor)).toEqual(['narrow', 'narrow', 'medium', 'medium', 'split', 'split']);
  });
});

describe('library', () => {
  it('resumes the last opened chapter from the Continue card', async () => {
    renderAt('/m/');
    const card = await screen.findByRole('region', { name: 'Continue reading' });
    expect(await within(card).findByText('Leader election')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('Distributed Systems: consensus with Raft')).toBeInTheDocument();

    await userEvent.click(within(card).getByText('Resume'));
    expect(window.location.pathname).toBe(`/m/courses/${RAFT_ID}/chapters/ch-2-2`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Leader election' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Starting an election' })).toBeInTheDocument();
    expect(screen.getByText('Next chapter')).toBeInTheDocument();
  });
});

describe('course outline', () => {
  it('lists the modules and opens a chapter', async () => {
    renderAt(`/m/courses/${RAFT_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Distributed Systems: consensus with Raft' })).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Why consensus is hard'));
    await userEvent.click(await screen.findByText('Replicated state machines'));
    expect(window.location.pathname).toMatch(new RegExp(`/m/courses/${RAFT_ID}/chapters/`));
  });
});

describe('reading settings', () => {
  it('applies each choice at once and remembers it on the device', async () => {
    renderAt('/m/settings');
    const sepia = screen.getByRole('button', { name: /Sepia/ });
    await userEvent.click(sepia);
    expect(sepia).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Sans' }));
    expect(useSettings.getState()).toMatchObject({ theme: 'sepia', typeface: 'sans' });
    expect(JSON.parse(window.localStorage.getItem('cw-reader-settings') ?? '{}')).toMatchObject({ theme: 'sepia', typeface: 'sans' });
    expect(await screen.findByText('Connected to your server')).toBeInTheDocument();
  });
});
