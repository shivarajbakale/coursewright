import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Tutor } from './useTutor';
import { useTutorUi } from './store';
import TutorPanel from './TutorPanel';
import { Quiz } from '../quiz/Quiz';

const ask = vi.fn();
let fake: Tutor;
vi.mock('./useTutor', () => ({ useTutor: () => fake }));

const hit = { n: 1, title: 'Model adapter: one interface over every provider', chapterId: 'c24', courseId: 'k', text: '…' };

function wrap(ui: React.ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  ask.mockReset();
  useTutorUi.setState({ open: true, expanded: false, selection: null, pending: null });
  fake = {
    ready: true,
    running: false,
    error: null,
    ask,
    retry: vi.fn(),
    items: [
      { kind: 'user', id: 'u1', text: 'Explain simpler', about: 'Think of a maths exam where you may do rough work.' },
      { kind: 'reply', id: 'a1', text: 'The adapter decides [1].', hits: [hit] },
    ],
  };
});

describe('tutor panel', () => {
  it('shows the conversation, and a citation opens its chapter', async () => {
    const onOpenSource = vi.fn();
    wrap(<TutorPanel courseId="k" chapterId="c25" courseTitle="Harness" chapterTitle="Reasoning block" label="Chapter 25" mode="sheet" onOpenSource={onOpenSource} />);
    expect(screen.getByText(/About “Think of a maths exam/)).toBeInTheDocument();
    expect(screen.getByText(/The adapter decides/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Source 1' }));
    expect(onOpenSource).toHaveBeenCalledWith(hit);
    await userEvent.click(screen.getByRole('link', { name: 'Open Model adapter' }));
    expect(onOpenSource).toHaveBeenCalledTimes(2);
  });

  it('sends a quick prompt about the picked paragraph, and unpicks it once the answer is in', async () => {
    useTutorUi.setState({ selection: 'A paragraph about margins.' });
    const view = wrap(<TutorPanel courseId="k" chapterId="c25" courseTitle="Harness" chapterTitle="Reasoning block" label="Chapter 25" mode="pane" onOpenSource={vi.fn()} />);
    expect(screen.getByText('About “A paragraph about margins.”')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Give an example' }));
    expect(ask).toHaveBeenCalledWith('Give an example', 'A paragraph about margins.');
    // Still there while the run goes: the request reads it as context.
    fake = { ...fake, running: true };
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TutorPanel courseId="k" chapterId="c25" courseTitle="Harness" chapterTitle="Reasoning block" label="Chapter 25" mode="pane" onOpenSource={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(useTutorUi.getState().selection).toBe('A paragraph about margins.');
    fake = { ...fake, running: false };
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TutorPanel courseId="k" chapterId="c25" courseTitle="Harness" chapterTitle="Reasoning block" label="Chapter 25" mode="pane" onOpenSource={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(useTutorUi.getState().selection).toBeNull();
  });

  it('sends a question handed over from elsewhere as soon as it opens', () => {
    useTutorUi.setState({ pending: 'Why is B wrong?' });
    wrap(<TutorPanel courseId="k" chapterId="c25" courseTitle="Harness" chapterTitle="Reasoning block" label="Chapter 25" mode="sheet" onOpenSource={vi.fn()} />);
    expect(ask).toHaveBeenCalledWith('Why is B wrong?', null);
    expect(useTutorUi.getState().pending).toBeNull();
  });

  it('closes on Escape', async () => {
    wrap(<TutorPanel courseId="k" chapterId="c25" courseTitle="Harness" chapterTitle="Reasoning block" label="Chapter 25" mode="sheet" onOpenSource={vi.fn()} />);
    await userEvent.keyboard('{Escape}');
    expect(useTutorUi.getState().open).toBe(false);
  });
});

describe('Ask why', () => {
  it('hands a wrong answer to the tutor with the question and the choice', async () => {
    const onAskWhy = vi.fn();
    wrap(
      <Quiz
        title="Quick quiz"
        questions={[{ id: 'q', prompt: 'Which field holds the answer?', options: ['reasoning', 'content'], answer: 1, explanation: 'content.' }]}
        onAskWhy={onAskWhy}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'reasoning' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ask the tutor why' }));
    expect(onAskWhy).toHaveBeenCalledWith('I got this question wrong: “Which field holds the answer?”. I chose “reasoning”. Help me see why.');
  });
});
