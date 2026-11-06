/**
 * One quiet line at the top while there is no connection, saying why some courses are dimmed and the
 * tutor is off. It goes away by itself when the connection comes back.
 */
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../settings';
import { font, space } from '../theme';
import { useOnline } from '../offline/online';
import { useOutbox } from '../offline/outbox';

export function OfflineBar() {
  const p = usePalette();
  const online = useOnline();
  const waiting = useOutbox().length;
  if (online) return null;
  return (
    <View role="status" style={[styles.bar, { backgroundColor: p.surface, borderBottomColor: p.border }]}>
      <Text style={[styles.text, { color: p.muted }]}>
        You're offline. Saved courses and chapters you opened still read
        {waiting ? `; ${waiting} ${waiting === 1 ? 'update waits' : 'updates wait'} to be sent.` : '.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 1 },
  text: { fontFamily: font.ui, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
