/**
 * The loading, empty and error states every reader screen owes. Skeletons mirror the shape of what
 * is coming; errors say what happened and offer one way forward, never raw error text.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../settings';
import { font, radius, space, touch } from '../theme';

export function Skeleton({ lines = 4, height = 16, gap = 12 }: { lines?: number; height?: number; gap?: number }) {
  const p = usePalette();
  return (
    <View style={{ gap }} aria-label="Loading" role="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={{ height, borderRadius: 6, backgroundColor: p.raised, width: i === lines - 1 ? '62%' : '100%' }} />
      ))}
    </View>
  );
}

export function Message({
  title,
  body,
  action,
  onAction,
  tone = 'plain',
}: {
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  tone?: 'plain' | 'error';
}) {
  const p = usePalette();
  return (
    <View style={[styles.box, { backgroundColor: p.surface, borderColor: p.border }]} role={tone === 'error' ? 'alert' : undefined}>
      <Text style={[styles.title, { color: tone === 'error' ? p.danger : p.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: p.muted }]}>{body}</Text> : null}
      {action && onAction ? (
        <Pressable
          role="button"
          onPress={onAction}
          style={({ pressed }) => [styles.button, { borderColor: p.borderStrong, backgroundColor: p.raised }, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: p.text }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The last resort when a screen fails to draw: say so and offer a reload, never a blank page. */
export function CrashScreen() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.ground, justifyContent: 'center', padding: space.lg }}>
      <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <Message tone="error" title="Something went wrong on this screen." body="Your reading position is saved. Reloading usually fixes it." action="Reload" onAction={() => window.location.reload()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: space.xl, gap: space.sm },
  title: { fontFamily: font.ui, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontFamily: font.ui, fontSize: 14, lineHeight: 21 },
  button: { alignSelf: 'flex-start', minHeight: touch, paddingHorizontal: space.lg, borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: space.sm },
  buttonText: { fontFamily: font.ui, fontSize: 15, fontWeight: '500' },
  pressed: { opacity: 0.7 },
});
