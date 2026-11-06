/**
 * A chapter's diagrams. On phones each is a row that opens in place, so the heavy players load only
 * when asked; from 700 px they start open.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Diagram } from '@/api/types';
import { usePalette } from '../settings';
import { font, radius, space, touch } from '../theme';
import { Icon } from '../components/TopBar';
import { FlowMovie } from './FlowMovie';
import { Mermaid } from './Mermaid';

export function Diagrams({ diagrams, startOpen }: { diagrams: Diagram[]; startOpen: boolean }) {
  if (diagrams.length === 0) return null;
  return (
    <View style={styles.list} role="region" aria-label="Diagrams">
      {diagrams.map((d) => (
        <DiagramCard key={d.id} diagram={d} startOpen={startOpen} />
      ))}
    </View>
  );
}

function DiagramCard({ diagram: d, startOpen }: { diagram: Diagram; startOpen: boolean }) {
  const p = usePalette();
  const [open, setOpen] = useState(startOpen);
  const kind = d.kind === 'flow' ? 'Movie' : 'Diagram';
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Pressable role="button" aria-expanded={open} onPress={() => setOpen((o) => !o)} style={({ hovered }) => [styles.head, hovered && { backgroundColor: p.raised }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.kind, { color: p.accentInk }]}>{kind}</Text>
          <Text style={[styles.title, { color: p.text }]}>{d.title}</Text>
        </View>
        <Text style={[styles.hint, { color: p.muted }]}>{open ? 'Hide' : 'Show'}</Text>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} color={p.muted} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {d.kind === 'flow' ? (
            <FlowMovie source={d.source} />
          ) : d.kind === 'mermaid' ? (
            <Mermaid source={d.source} />
          ) : (
            // An SVG drawn by the course builder, shown as an image so it cannot run scripts.
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.source)}`} alt={d.title} style={{ maxWidth: '100%', height: 'auto' }} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: touch + 16 },
  kind: { fontFamily: font.ui, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontFamily: font.ui, fontSize: 16, fontWeight: '500', lineHeight: 21 },
  hint: { fontFamily: font.ui, fontSize: 13 },
  body: { paddingHorizontal: space.md, paddingBottom: space.lg },
});
