/**
 * "A new version is ready": shown when a new service worker is waiting. Reload switches to it (the
 * reading position is kept by the scroll marks); Later hides it until the next new version.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../settings';
import { font, radius, space, touch } from '../theme';
import { useUpdate } from '../offline/register';

export function UpdatePrompt() {
  const p = usePalette();
  const { waiting, dismissed, apply, dismiss } = useUpdate();
  if (!waiting || dismissed || !apply) return null;
  return (
    <View role="alertdialog" aria-label="Update" style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: p.raised, borderColor: p.borderStrong }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.text }]}>A new version of the reader is ready</Text>
          <Text style={[styles.body, { color: p.muted }]}>Reload when you're ready; your place is kept.</Text>
        </View>
        <Pressable role="button" onPress={dismiss} style={styles.button}>
          <Text style={[styles.label, { color: p.muted }]}>Later</Text>
        </Pressable>
        <Pressable role="button" onPress={apply} style={[styles.button, styles.primary, { backgroundColor: p.accent }]}>
          <Text style={[styles.label, { color: p.onAccent }]}>Reload</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 40, padding: space.md, paddingTop: 'calc(12px + env(safe-area-inset-top))', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.sm, width: '100%', maxWidth: 560, borderWidth: 1, borderRadius: radius.lg, padding: space.md, paddingLeft: space.lg, boxShadow: '0 12px 32px rgba(0,0,0,0.35)' },
  title: { fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
  body: { fontFamily: font.ui, fontSize: 13, lineHeight: 18, marginTop: 2 },
  button: { minHeight: touch, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  primary: {},
  label: { fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
});
