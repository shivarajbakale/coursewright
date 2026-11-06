/** Shapes and helpers the quiz shares with the tutor. Kept apart from Quiz.tsx so fast refresh works. */
export type Result = { chosen: number; correct: boolean };

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  lastAttempt?: Result | null;
};

/** What to ask the tutor about a wrong answer. */
export function askWhyPrompt(q: QuizQuestion, chosen: number): string {
  return `I got this question wrong: “${q.prompt}”. I chose “${q.options[chosen]}”. Help me see why.`;
}

