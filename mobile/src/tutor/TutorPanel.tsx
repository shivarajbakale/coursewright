/**
 * The tutor, as a bottom sheet (below 1024 px) or a pane docked beside the chapter (from 1024 px).
 * The sheet sizes to its conversation, up to 75% of the window, and can expand to full height;
 * content runs the sheet's full width with one gutter, so every edge lines up.
 *
 * Loaded lazily: this module pulls in the tutor connection (CopilotKit core).
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { ScrollViewHandle } from 'react-native';
import { usePalette } from '../settings';
import { breakpoint, font, radius, space, touch } from '../theme';
import { Icon, IconButton } from '../components/TopBar';
import { useTutorUi } from './store';
import { Transcript, type OpenSource } from './Conversation';
import { useTutor } from './useTutor';
import { useOnline } from '../offline/online';

const PROMPTS = ['Explain simpler', 'Give an example', 'Quiz me', 'Why does this matter?'];

export default function TutorPanel({
  courseId,
  chapterId,
  courseTitle,
  chapterTitle,
  label,
  mode,
  onOpenSource,
}: {
  courseId: string;
  chapterId: string;
  courseTitle: string;
  chapterTitle: string;
  label: string;
  mode: 'sheet' | 'pane';
  onOpenSource: OpenSource;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const ui = useTutorUi();
  const tutor = useTutor({ courseId, chapterId, courseTitle, chapterTitle, selection: ui.selection });
  const online = useOnline();
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollViewHandle>(null);
  const gutter = width >= breakpoint.wide ? 28 : space.lg;

  const send = (text: string) => {
    if (!text.trim() || tutor.running || !tutor.ready || !online) return;
    tutor.ask(text, ui.selection);
  };

  // The tapped paragraph rides along as context until the answer is in. The run reads the context
  // after an await, so clearing it on send would race the request and the tutor would never see it.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !tutor.running && ui.selection) ui.select(null);
    wasRunning.current = tutor.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the end of a run clears the paragraph
  }, [tutor.running]);

  // A question asked from elsewhere (Ask why, a paragraph chip) goes as soon as the tutor is ready.
  useEffect(() => {
    if (!tutor.ready || tutor.running || !online) return;
    const pending = ui.takePending();
    if (pending) send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when readiness or the pending question changes
  }, [tutor.ready, tutor.running, online, ui.pending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  const sheet = mode === 'sheet';
  const disabled = !online || !tutor.ready || tutor.running;

  return (
    <View
      role="dialog"
      aria-label="Tutor"
      style={
        sheet
          ? [styles.sheet, { backgroundColor: p.surface, borderColor: p.borderStrong, maxHeight: ui.expanded ? '100%' : '75%' }, ui.expanded && styles.sheetFull]
          : [styles.pane, { backgroundColor: p.surface, borderLeftColor: p.border }]
      }
    >
      {sheet ? <View style={[styles.grabber, { backgroundColor: p.borderStrong }]} aria-hidden /> : null}
      <View style={[styles.header, { paddingLeft: gutter, paddingRight: gutter - 12 }]}>
        <View style={styles.titleRow}>
          <Text role="heading" aria-level={2} style={[styles.title, { color: p.text }]}>
            Tutor
          </Text>
          <Text style={[styles.label, { color: p.muted }]}>{label}</Text>
        </View>
        {sheet ? (
          <IconButton label={ui.expanded ? 'Shrink the tutor' : 'Expand the tutor'} onPress={ui.toggleExpanded}>
            <Icon name={ui.expanded ? 'chevronDown' : 'chevronUp'} color={p.muted} />
          </IconButton>
        ) : null}
        <IconButton label="Close the tutor" onPress={ui.close}>
          <Icon name="close" color={p.text} />
        </IconButton>
      </View>

      <ScrollView
        ref={scroller}
        style={sheet ? styles.bodySheet : styles.bodyPane}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.sm }}
        onContentSizeChange={(_w, h) => scroller.current?.scrollTo({ y: h, animated: true })}
      >
        {tutor.items.length === 0 && !tutor.running ? (
          <Text style={[styles.empty, { color: p.muted }]}>
            {online ? 'Ask anything about this chapter, or tap a paragraph first.' : 'The tutor needs a connection. Reading still works.'}
          </Text>
        ) : (
          <Transcript items={tutor.items} running={tutor.running} error={tutor.error} onRetry={tutor.retry} onOpenSource={onOpenSource} onAsk={send} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: gutter }]}>
        {ui.selection ? (
          <View style={[styles.chip, { backgroundColor: p.tint, borderColor: p.border }]}>
            <Text style={[styles.chipText, { color: p.text }]} numberOfLines={1}>
              About “{ui.selection}”
            </Text>
            <Pressable role="button" accessibilityLabel="Don't ask about this paragraph" onPress={() => ui.select(null)} style={styles.chipX}>
              <Icon name="close" size={14} color={p.muted} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.prompts} role="group" aria-label="Quick prompts">
          {PROMPTS.map((q) => (
            <Pressable
              key={q}
              role="button"
              disabled={disabled}
              onPress={() => send(q)}
              style={({ hovered }) => [styles.prompt, { borderColor: p.borderStrong, backgroundColor: hovered && !disabled ? p.borderStrong : p.raised }, disabled && styles.off]}
            >
              <Text style={[styles.promptText, { color: p.text }]}>{q}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => {
              send(draft);
              setDraft('');
            }}
            editable={online}
            placeholder={online ? 'Ask about this chapter' : 'Tutor needs a connection'}
            placeholderTextColor={p.muted}
            accessibilityLabel="Ask the tutor"
            style={[styles.input, { borderColor: p.borderStrong, backgroundColor: p.ground, color: p.text }]}
          />
          <Pressable
            role="button"
            accessibilityLabel="Send"
            disabled={disabled || !draft.trim()}
            onPress={() => {
              send(draft);
              setDraft('');
            }}
            style={[styles.send, { backgroundColor: p.accent }, (disabled || !draft.trim()) && styles.off]}
          >
            <Icon name="arrowUp" size={20} color={p.onAccent} stroke={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
  },
  sheetFull: { top: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  pane: { width: 360, borderLeftWidth: 1, height: '100%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { fontFamily: font.ui, fontSize: 17, fontWeight: '600' },
  label: { fontFamily: font.ui, fontSize: 13 },
  // The sheet's message area sizes to its content and shrinks (then scrolls) when the sheet hits its cap.
  bodySheet: { flexGrow: 0, flexShrink: 1 },
  bodyPane: { flex: 1 },
  empty: { fontFamily: font.ui, fontSize: 15, lineHeight: 21, paddingVertical: space.sm },
  // Clear of the iPhone home indicator: the root leaves the bottom inset to the sheet.
  footer: { gap: 10, paddingTop: space.md, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.sm, paddingLeft: space.md },
  chipText: { flex: 1, fontFamily: font.ui, fontSize: 13 },
  chipX: { width: touch, height: 36, alignItems: 'center', justifyContent: 'center' },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  prompt: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  promptText: { fontFamily: font.ui, fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: space.lg, fontFamily: font.ui, fontSize: 16 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.45 },
});
