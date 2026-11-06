/** What the reader shows of a tutor conversation. Kept free of CopilotKit so it tests in isolation. */
export const TUTOR_AGENT = 'tutor';

export type Line = { id: string; role: 'user' | 'assistant'; text: string };

/** Keep only the learner's questions and the tutor's text replies; tool traffic and empty turns stay hidden. */
export function visibleLines(messages: ReadonlyArray<{ id: string; role: string; content?: unknown }>): Line[] {
  return messages.flatMap((m) =>
    (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
      ? [{ id: m.id, role: m.role, text: m.content }]
      : [],
  );
}
