import { create } from 'zustand';

/**
 * What the tutor can see, and whether its side panel is open.
 *
 * Screens write their context here (the chapter being read, the open note, the
 * words selected); `TutorContext` forwards it to the agent with every turn
 * through CopilotKit's `useAgentContext`. Any screen can open the panel with a
 * prompt prefilled: `useTutor.getState().ask('Explain this', { selection })`.
 */
export interface TutorContextValue {
  courseId: string | null;
  chapterId: string | null;
  noteId: string | null;
  selection: string | null;
}

interface TutorState extends TutorContextValue {
  panelOpen: boolean;
  /** A prompt waiting to be sent when the chat mounts. */
  pending: string | null;
  setContext: (ctx: Partial<TutorContextValue>) => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  ask: (prompt: string, ctx?: Partial<TutorContextValue>) => void;
  takePending: () => string | null;
}

export const useTutor = create<TutorState>((set, get) => ({
  courseId: null,
  chapterId: null,
  noteId: null,
  selection: null,
  panelOpen: false,
  pending: null,
  setContext: (ctx) => set(ctx),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  ask: (prompt, ctx) => set({ ...(ctx ?? {}), pending: prompt, panelOpen: true }),
  takePending: () => {
    const p = get().pending;
    if (p) set({ pending: null });
    return p;
  },
}));
