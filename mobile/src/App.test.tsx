import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { visibleLines } from './tutorLines';

// The tutor box needs a live CopilotKit runtime; the library is what this test is about.
vi.mock('./TutorProbe', () => ({ TutorProbe: () => null }));

describe('reader spike', () => {
  it('lists the courses from /api/courses with React Native components', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Your courses')).toBeInTheDocument();
    expect(await screen.findByText('Distributed Systems: consensus with Raft')).toBeInTheDocument();
  });

  it('shows only the learner questions and tutor text replies', () => {
    const lines = visibleLines([
      { id: '1', role: 'user', content: 'What is a term?' },
      { id: '2', role: 'assistant', content: '' },
      { id: '3', role: 'tool', content: '{"hits":[]}' },
      { id: '4', role: 'assistant', content: 'A term is an election period.' },
      { id: '5', role: 'assistant', content: [{ type: 'text', text: 'parts' }] },
    ]);
    expect(lines.map((l) => l.id)).toEqual(['1', '4']);
  });
});
