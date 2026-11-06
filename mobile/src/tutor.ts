/**
 * The reader's tutor connection: CopilotKit's framework-free core talking to the same runtime the
 * web app uses (/api/copilotkit, which forwards to the tutor deep agent over AG-UI).
 *
 * Not `@copilotkit/react-core`: its v2 entry bundles the whole chat UI (markdown renderer, syntax
 * highlighter, mermaid, KaTeX) and its stylesheet, about 2.4 MB of script the reader never runs.
 * The core is the same client underneath; this file is the small React binding the reader needs.
 */
import { useEffect, useReducer, useState } from 'react';
import { CopilotKitCore } from '@copilotkit/core';
import { TUTOR_AGENT, visibleLines } from './tutorLines';

/** The agent type as the core sees it (its own copy of @ag-ui/client, not the app's). */
type AbstractAgent = NonNullable<ReturnType<CopilotKitCore['getAgent']>>;

let core: CopilotKitCore | null = null;
/** One connection per page, made on first use so a screen without the tutor never opens it. */
function tutorCore(): CopilotKitCore {
  core ??= new CopilotKitCore({ runtimeUrl: '/api/copilotkit' });
  return core;
}

/** The tutor agent once the runtime has announced it; null until then. */
function useTutorAgent(): AbstractAgent | null {
  const kit = tutorCore();
  const [agent, setAgent] = useState<AbstractAgent | null>(() => kit.getAgent(TUTOR_AGENT) ?? null);
  useEffect(() => {
    const sub = kit.subscribe({ onAgentsChanged: () => setAgent(kit.getAgent(TUTOR_AGENT) ?? null) });
    setAgent(kit.getAgent(TUTOR_AGENT) ?? null);
    return () => sub.unsubscribe();
  }, [kit]);
  return agent;
}

export type TutorContext = { courseId: string | null; chapterId: string | null; selection: string | null };

/**
 * Ask questions and read the streamed answer. `context` goes with every run, like the web app's
 * `useAgentContext`; `surface: mobile` tells the tutor this reader has no notes to save into.
 */
export function useTutor(context: TutorContext) {
  const kit = tutorCore();
  const agent = useTutorAgent();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    const sub = kit.subscribeToAgentWithOptions(
      agent,
      {
        onMessagesChanged: rerender,
        onRunInitialized: rerender,
        onRunFinalized: rerender,
        onRunFailed: ({ error: e }) => {
          setError(e.message);
          rerender();
        },
      },
      { throttleMs: 50 },
    );
    return () => sub.unsubscribe();
  }, [kit, agent]);

  const value = JSON.stringify({ ...context, surface: 'mobile' });
  useEffect(() => {
    const id = kit.addContext({
      description: 'Where the learner is. Scope answers to this course and chapter. The reader app has no notes.',
      value,
      agentIds: [TUTOR_AGENT],
    });
    return () => kit.removeContext(id);
  }, [kit, value]);

  function ask(text: string) {
    if (!agent || agent.isRunning || !text.trim()) return;
    setError(null);
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text.trim() });
    kit.runAgent({ agent }).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }

  return {
    ready: agent !== null,
    running: agent?.isRunning ?? false,
    lines: agent ? visibleLines(agent.messages) : [],
    error,
    ask,
  };
}
