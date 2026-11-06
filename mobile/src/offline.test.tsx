import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Chapter, Question } from '@/api/types';
import { enqueue, flush, pending, resetOutbox, type OutboxItem } from './offline/outbox';
import { formatBytes, resetSaved } from './offline/saved';
import { readerKeys } from './queries';
import { Quiz } from './quiz/Quiz';
import { OfflineBar } from './components/OfflineBar';

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

let online = true;
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  resetOutbox();
  resetSaved();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const goOffline = () => {
  online = false;
  window.dispatchEvent(new Event('offline'));
};

describe('the outbox', () => {
  it('keeps one progress item per chapter, and once finished it stays finished', () => {
    enqueue({ kind: 'progress', chapterId: 'a', finished: true });
    enqueue({ kind: 'progress', chapterId: 'a', finished: false });
    enqueue({ kind: 'attempt', questionId: 'q', chapterId: 'a', chosen: 1 });
    expect(pending().map((i) => [i.kind, 'finished' in i ? i.finished : i.chosen])).toEqual([
      ['progress', true],
      ['attempt', 1],
    ]);
    expect(JSON.parse(localStorage.getItem('cw-reader-outbox')!)).toHaveLength(2);
  });

  it('sends oldest first, keeps what failed for lack of a connection, drops what the server refused', async () => {
    enqueue({ kind: 'progress', chapterId: 'gone', finished: true });
    enqueue({ kind: 'progress', chapterId: 'ok', finished: true });
    enqueue({ kind: 'progress', chapterId: 'later', finished: true });
    const sent: string[] = [];
    const send = async (i: OutboxItem) => {
      const id = i.kind === 'progress' ? i.chapterId : i.questionId;
      if (id === 'gone') throw { status: 404 };
      if (id === 'later') throw { status: 0 };
      sent.push(id);
    };
    expect(await flush(send)).toBe(1);
    expect(sent).toEqual(['ok']);
    expect(pending().map((i) => (i.kind === 'progress' ? i.chapterId : ''))).toEqual(['later']);
  });

  it('formats sizes', () => {
    expect([formatBytes(300), formatBytes(40_000), formatBytes(4.4 * 1024 * 1024)]).toEqual(['1 KB', '39 KB', '4.4 MB']);
  });
});

const question: Question = {
  id: 'ch-1-1-q0',
  prompt: 'Which order gives the same state?',
  options: ['Any order', 'The same order'],
  answer: 1,
  explanation: 'Same commands in the same order give the same state.',
  conceptIds: [],
  lastAttempt: null,
};

describe('offline reading', () => {
  it('checks a quiz answer on the device and queues it to send later', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData<Partial<Chapter>>(readerKeys.chapter('ch-1-1'), { id: 'ch-1-1', questions: [question] });
    render(
      <QueryClientProvider client={client}>
        <Quiz chapterId="ch-1-1" questions={[question]} />
      </QueryClientProvider>,
    );
    goOffline();
    await userEvent.click(screen.getByRole('radio', { name: /The same order/ }));
    expect(await screen.findByText('Right')).toBeInTheDocument();
    expect(screen.getByText(/Checked on this device/)).toBeInTheDocument();
    expect(pending()).toMatchObject([{ kind: 'attempt', questionId: 'ch-1-1-q0', chosen: 1 }]);
  });

  it('says once that the reader is offline, and how much waits to be sent', () => {
    const { container, unmount } = render(<OfflineBar />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    enqueue({ kind: 'progress', chapterId: 'a', finished: true });
    goOffline();
    render(<OfflineBar />);
    expect(screen.getByRole('status')).toHaveTextContent("You're offline. Saved courses and chapters you opened still read; 1 update waits to be sent.");
  });
});
