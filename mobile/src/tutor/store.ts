/**
 * Whether the tutor is open, and what the next question is about. Shared by the chapter (paragraph
 * taps, the Ask button, the quiz's Ask why) and the tutor panel.
 */
import { create } from 'zustand';

type TutorUi = {
  open: boolean;
  expanded: boolean;
  /** The paragraph the next question is about, if one was tapped. */
  selection: string | null;
  /** A question to send as soon as the tutor is ready (quick prompt from elsewhere, Ask why). */
  pending: string | null;
  openTutor: (opts?: { ask?: string; selection?: string | null }) => void;
  close: () => void;
  toggleExpanded: () => void;
  select: (paragraph: string | null) => void;
  takePending: () => string | null;
};

export const useTutorUi = create<TutorUi>((set, get) => ({
  open: false,
  expanded: false,
  selection: null,
  pending: null,
  openTutor: (opts) =>
    set((s) => ({
      open: true,
      pending: opts?.ask ?? s.pending,
      selection: opts?.selection !== undefined ? opts.selection : s.selection,
    })),
  close: () => set({ open: false, expanded: false }),
  toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
  select: (paragraph) => set((s) => ({ selection: s.selection === paragraph ? null : paragraph })),
  takePending: () => {
    const p = get().pending;
    if (p) set({ pending: null });
    return p;
  },
}));
