/**
 * CopilotKit wiring for the tutor.
 *
 * - `TutorProvider` mounts CopilotKit once at the root, pointed at the runtime
 *   (`/api/copilotkit`: runtime-dev/server.ts locally, a Vercel function in
 *   production), which forwards to the Python tutor deep agent over AG-UI.
 * - `TutorBridge` forwards what the reader is looking at (course, chapter,
 *   note, selection) as agent context on every turn, and registers the
 *   frontend tools the agent can call: `save_to_notes` and `open_chapter`.
 * - `TutorChat` is the chat itself, used by the side panel and the Tutor page.
 */
import { useEffect } from 'react';
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { Center, Loader, useComputedColorScheme } from '@mantine/core';
import {
  CopilotChat,
  CopilotKitProvider,
  useAgent,
  useAgentContext,
  useCopilotKit,
  useFrontendTool,
} from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import { useCreateNote } from '@/hooks/useCoursewright';
import { toast } from '@/lib/notify';
import { useTutor } from './tutorStore';
import { TutorPageTools, TutorToolRenderers } from './TutorToolRenderers';

export const TUTOR_AGENT = 'tutor';

/** The agent service answers `{"message": ...}`; show that, not the HTTP wrapper. */
function tutorErrorMessage(raw: string): string {
  const match = /\{"message":"([^"]+)"\}/.exec(raw);
  return `The tutor couldn't answer: ${match ? match[1] : raw}`;
}

export function TutorProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      agentId={TUTOR_AGENT}
      enableInspector={false}
      showDevConsole={false}
      onError={(e) => {
        // A failed run is the learner's business; a missing runtime while they read is not.
        if (String(e.code).startsWith('agent_run')) toast.error(tutorErrorMessage(e.error.message));
        else console.warn('[tutor]', e.code, e.error.message);
      }}
    >
      <TutorBridge />
      <TutorToolRenderers />
      <TutorPageTools />
      {children}
    </CopilotKitProvider>
  );
}

/** CopilotKit's chat themes itself from a `.dark` ancestor; follow Mantine's scheme. */
function useCopilotColorScheme() {
  const scheme = useComputedColorScheme('dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', scheme === 'dark');
  }, [scheme]);
}

function TutorBridge() {
  useCopilotColorScheme();
  const { courseId, chapterId, noteId, selection } = useTutor();
  const navigate = useNavigate();
  const createNote = useCreateNote();

  useAgentContext({
    description:
      'Where the learner is in Coursewright right now. Scope answers to this course and chapter unless asked otherwise.',
    value: { courseId, chapterId, noteId, selection },
  });

  useFrontendTool(
    {
      name: 'save_to_notes',
      description:
        "Save markdown to the learner's notes as a new page, linked to the current course and chapter. Use when they ask to keep or note something.",
      parameters: z.object({
        markdown: z.string().describe('The note body, in markdown'),
        title: z.string().optional().describe('A short page title'),
      }),
      handler: async ({ markdown, title }) => {
        const page = await createNote.mutateAsync({
          title: title ?? 'From the tutor',
          icon: '💬',
          markdown,
          courseId,
          chapterId,
        });
        return `Saved as note "${page.title}" (id ${page.id}).`;
      },
    },
    [courseId, chapterId]
  );

  useFrontendTool(
    {
      name: 'open_chapter',
      description: 'Open a chapter of the current course in the reader.',
      parameters: z.object({
        courseId: z.string(),
        chapterId: z.string(),
      }),
      handler: async ({ courseId: c, chapterId: ch }) => {
        await navigate({ to: '/courses/$courseId/chapters/$chapterId', params: { courseId: c, chapterId: ch } });
        return 'Opened.';
      },
    },
    [navigate]
  );

  return null;
}

/** Sends a prompt queued with `useTutor().ask(...)` once the chat is mounted. */
function PendingPrompt() {
  const { agent } = useAgent({ agentId: TUTOR_AGENT });
  const { copilotkit } = useCopilotKit();
  const pending = useTutor((s) => s.pending);

  useEffect(() => {
    if (!pending) return;
    const prompt = useTutor.getState().takePending();
    if (!prompt) return;
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: prompt });
    void copilotkit.runAgent({ agent }).catch(() => undefined);
  }, [pending, agent, copilotkit]);

  return null;
}

/**
 * While the chat attaches to its thread, the app's own spinner rather than
 * CopilotKit's: one loading indicator across the app, and one the theme marks
 * as a loader (`data-slot="loader"`).
 */
function TutorConnecting() {
  return (
    <Center py="xl" role="status" aria-label="Connecting to the tutor">
      <Loader size="sm" />
    </Center>
  );
}

export function TutorChat({ threadId }: { threadId?: string }) {
  return (
    <>
      <PendingPrompt />
      <CopilotChat
        agentId={TUTOR_AGENT}
        threadId={threadId}
        connectingIndicator={TutorConnecting}
        labels={{
          chatInputPlaceholder: 'Ask about this course…',
          welcomeMessageText: 'Ask anything about your course. Answers cite the chapters they come from.',
        }}
      />
    </>
  );
}
