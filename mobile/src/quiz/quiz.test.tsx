import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Diagram, Question } from '@/api/types';
import { Quiz } from './Quiz';
import { Diagrams } from '../diagrams/Diagrams';

// Question ids follow the mock's `<chapterId>-q<n>`, so POST /api/questions/:id/attempts is answered by MSW.
const questions: Question[] = [
  {
    id: 'ch-1-1-q0',
    prompt: 'Two replicas applied the same commands but ended in different states. What must be true?',
    options: ['They used different hardware', 'They applied the commands in a different order', 'One had more memory', 'The network was slow'],
    answer: 1,
    explanation: 'Same commands in the same order give the same state.',
    conceptIds: [],
    lastAttempt: null,
  },
];

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Check yourself', () => {
  it('asks one question, marks a wrong choice and the right answer, then scores', async () => {
    const two = [questions[0], { ...questions[0], id: 'ch-1-2-q0', prompt: 'Second question?' }];
    wrap(<Quiz chapterId="ch-1-1" questions={two} />);
    expect(screen.getByText(questions[0].prompt)).toBeInTheDocument();
    expect(screen.queryByText('Second question?')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /different hardware/ }));
    expect(await screen.findByText('Not quite')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Correct answer' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Your answer, not right' })).toBeInTheDocument();

    await userEvent.click(screen.getByText('Next question'));
    expect(screen.getByText('Second question?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /different order/ }));
    expect(await screen.findByText('Right')).toBeInTheDocument();
    await userEvent.click(screen.getByText('See your score'));
    expect(screen.getByText('You got 1 of 2 right.')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Try again'));
    expect(screen.getByText(questions[0].prompt)).toBeInTheDocument();
  });

  it('shows answers already given as answered when you come back', () => {
    wrap(<Quiz chapterId="ch-1-1" questions={[{ ...questions[0], lastAttempt: { chosen: 1, correct: true } }]} />);
    expect(screen.getByText('You got 1 of 1 right.')).toBeInTheDocument();
  });
});

describe('Diagrams', () => {
  const diagrams: Diagram[] = [
    { id: 'd1', kind: 'flow', title: 'The agent loop', source: 'title x' },
    { id: 'd2', kind: 'mermaid', title: 'Your map so far', source: 'this is not mermaid %%% ::' },
  ];

  it('starts closed on phones and opens in place', async () => {
    wrap(<Diagrams diagrams={diagrams} startOpen={false} />);
    const movie = screen.getByRole('button', { name: /The agent loop/ });
    expect(movie).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Loading the movie…')).not.toBeInTheDocument();
    await userEvent.click(movie);
    expect(movie).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Loading the movie…')).toBeInTheDocument();
  });

  it('shows a broken diagram as its text instead of failing', async () => {
    wrap(<Diagrams diagrams={[diagrams[1]]} startOpen />);
    expect(await screen.findByText('This diagram has a syntax error, so here is its text.', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(diagrams[1].source)).toBeInTheDocument();
  });
});
