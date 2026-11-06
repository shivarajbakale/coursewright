/**
 * The reader's tutor connection: CopilotKit's framework-free core talking to the same runtime the
 * web app uses (/api/copilotkit, which forwards to the tutor deep agent over AG-UI).
 *
 * Not `@copilotkit/react-core`: its v2 entry bundles the whole chat UI (markdown renderer, syntax
 * highlighter, mermaid, KaTeX) and its stylesheet, about 2.4 MB of script the reader never runs.
 * This module is loaded only when the tutor first opens (TutorPanel is lazy).
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { CopilotKitCore } from '@copilotkit/core';
import { buildTranscript, type Item, type LooseMessage } from './transcript';
import { loadThread, saveThread, type Thread } from './threads';
import { uid } from '../uid';

export const TUTOR_AGENT = 'tutor';

/** The agent type as the core sees it (its own copy of @ag-ui/client, not the app's). */
type Agent = NonNullable<ReturnType<CopilotKitCore['getAgent']>>;
type AgentMessages = Parameters<Agent['setMessages']>[0];

let core: CopilotKitCore | null = null;
function tutorCore(): CopilotKitCore {
  core ??= new CopilotKitCore({ runtimeUrl: '/api/copilotkit' });
  return core;
}

function useAgent(): Agent | null {
  const kit = tutorCore();
  const [agent, setAgent] = useState<Agent | null>(() => kit.getAgent(TUTOR_AGENT) ?? null);
  useEffect(() => {
    const sub = kit.subscribe({ onAgentsChanged: () => setAgent(kit.getAgent(TUTOR_AGENT) ?? null) });
    setAgent(kit.getAgent(TUTOR_AGENT) ?? null);
    return () => sub.unsubscribe();
  }, [kit]);
  return agent;
}

/** Titles go too, so the tutor never has to guess what an id refers to. */
export type TutorContext = { courseId: string; chapterId: string; courseTitle: string; chapterTitle: string; selection: string | null };

export type Tutor = {
  ready: boolean;
  running: boolean;
  items: Item[];
  error: string | null;
  ask: (text: string, about?: string | null) => void;
  retry: () => void;
};

/**
 * Ask questions about one chapter and read the streamed answers. Each chapter has its own
 * conversation; `context` goes with every run, and `surface: mobile` tells the tutor this reader
 * has no notes to save into.
 */
export function useTutor({ courseId, chapterId, courseTitle, chapterTitle, selection }: TutorContext): Tutor {
  const kit = tutorCore();
  const agent = useAgent();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [error, setError] = useState<string | null>(null);
  const thread = useRef<Thread | null>(null);

  // Switch the agent to this chapter's conversation.
  useEffect(() => {
    if (!agent) return;
    if (agent.isRunning) agent.abortRun();
    const t = loadThread(chapterId);
    thread.current = t;
    agent.threadId = t.threadId;
    agent.setMessages(t.messages as unknown as AgentMessages);
    setError(null);
    rerender();
  }, [agent, chapterId]);

  useEffect(() => {
    if (!agent) return;
    const persist = () => {
      if (thread.current) saveThread(chapterId, { ...thread.current, messages: agent.messages as unknown as LooseMessage[] });
    };
    const sub = kit.subscribeToAgentWithOptions(
      agent,
      {
        onMessagesChanged: rerender,
        onRunInitialized: rerender,
        onRunFinalized: () => {
          persist();
          rerender();
        },
        onRunFailed: ({ error: e }) => {
          setError(e.message);
          persist();
          rerender();
        },
      },
      { throttleMs: 50 },
    );
    return () => sub.unsubscribe();
  }, [kit, agent, chapterId]);

  const value = JSON.stringify({ courseId, courseTitle, chapterId, chapterTitle, selection, surface: 'mobile' });
  useEffect(() => {
    const id = kit.addContext({
      description:
        'Where the learner is in the phone reader. Scope answers to this course and chapter; `selection` is the paragraph they asked about. The reader app has no notes, so never offer to save one.',
      value,
      agentIds: [TUTOR_AGENT],
    });
    return () => kit.removeContext(id);
  }, [kit, value]);

  const run = () => {
    if (!agent) return;
    setError(null);
    kit.runAgent({ agent }).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  return {
    ready: agent !== null,
    running: agent?.isRunning ?? false,
    items: agent && thread.current ? buildTranscript(agent.messages as unknown as LooseMessage[], thread.current.about, agent.isRunning) : [],
    error,
    ask: (text, about = null) => {
      if (!agent || agent.isRunning || !text.trim() || !thread.current) return;
      const id = uid();
      if (about) thread.current.about[id] = about;
      agent.addMessage({ id, role: 'user', content: text.trim() });
      run();
    },
    retry: () => {
      if (agent && !agent.isRunning) run();
    },
  };
}
