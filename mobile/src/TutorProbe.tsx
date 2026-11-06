/**
 * The spike's tutor box: one question, one streamed answer, through the same CopilotKit runtime the
 * web app uses (/api/copilotkit), rendered in React Native components.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, font, radius, space, touch } from './theme';
import { useTutor } from './tutor';

export function TutorProbe({ courseId }: { courseId: string | null }) {
  const tutor = useTutor({ courseId, chapterId: null, selection: null });
  const [draft, setDraft] = useState('');
  const { lines, running, error } = tutor;

  function send() {
    if (!draft.trim() || running || !tutor.ready) return;
    tutor.ask(draft);
    setDraft('');
  }

  return (
    <View style={styles.box} role="region" aria-label="Tutor">
      <Text style={styles.title}>Ask the tutor</Text>
      <View style={styles.thread} aria-live="polite">
        {lines.length === 0 && (
          <Text style={styles.hint}>{tutor.ready ? 'Ask anything about your courses.' : 'Connecting to the tutor…'}</Text>
        )}
        {lines.map((l) => (
          <Text key={l.id} style={l.role === 'user' ? styles.user : styles.reply}>
            {l.text}
          </Text>
        ))}
        {running && <ActivityIndicator color={color.accent} accessibilityLabel="Tutor is answering" />}
        {error && <Text style={styles.error}>The tutor couldn’t answer: {error}</Text>}
      </View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Ask about this course"
          placeholderTextColor={color.muted}
          accessibilityLabel="Ask the tutor"
        />
        <Pressable
          onPress={send}
          disabled={running || !draft.trim()}
          role="button"
          accessibilityLabel="Send"
          style={({ pressed }) => [styles.send, (running || !draft.trim()) && styles.sendOff, pressed && styles.pressed]}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: color.surface, borderColor: color.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  title: { color: color.text, fontFamily: font.ui, fontSize: 17, fontWeight: '600' },
  thread: { gap: space.md },
  hint: { color: color.muted, fontFamily: font.ui, fontSize: 15 },
  user: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: color.borderStrong, color: color.text, fontFamily: font.ui, fontSize: 15, lineHeight: 21, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  reply: { color: color.body, fontFamily: font.ui, fontSize: 15, lineHeight: 23 },
  error: { color: color.danger, fontFamily: font.ui, fontSize: 14 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.ground, color: color.text, fontFamily: font.ui, fontSize: 16, paddingHorizontal: space.lg },
  send: { width: 48, height: 48, minWidth: touch, borderRadius: 24, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  sendText: { color: color.onAccent, fontSize: 20, fontWeight: '700' },
});
