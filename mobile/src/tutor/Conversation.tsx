/**
 * A tutor conversation: your questions, the replies (markdown, with [n] citations that open the
 * cited chapter and a list of sources), and a card for each tool the tutor used.
 */
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../settings';
import { font, radius, space } from '../theme';
import { Blocks } from '../markdown/blocks';
import { parseReply } from '../markdown/parse';
import { Diagrams } from '../diagrams/Diagrams';
import { Quiz } from '../quiz/Quiz';
import { shortTitle } from '../courseMath';
import { citedHits, sourcesByChapter, type Hit, type Item } from './transcript';

export type OpenSource = (hit: Hit) => void;

export function Transcript({
  items,
  running,
  error,
  onRetry,
  onOpenSource,
  onAsk,
}: {
  items: Item[];
  running: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSource: OpenSource;
  onAsk: (prompt: string) => void;
}) {
  const p = usePalette();
  const last = items[items.length - 1];
  const thinking = running && (!last || last.kind === 'user');
  return (
    <View style={styles.list} aria-live="polite">
      {items.map((item) => {
        switch (item.kind) {
          case 'user':
            return (
              <View key={item.id} style={styles.mine}>
                {item.about ? (
                  <Text style={[styles.about, { color: p.muted }]} numberOfLines={1}>
                    About “{item.about.slice(0, 60)}
                    {item.about.length > 60 ? '…' : ''}”
                  </Text>
                ) : null}
                <Text style={[styles.bubble, { backgroundColor: p.borderStrong, color: p.text }]}>{item.text}</Text>
              </View>
            );
          case 'reply':
            return <Reply key={item.id} text={item.text} hits={item.hits} onOpenSource={onOpenSource} />;
          case 'tool':
            return <ToolCard key={item.id} item={item} onAsk={onAsk} />;
        }
      })}
      {thinking ? <Working label="Thinking…" /> : null}
      {error ? (
        <View style={styles.errorRow} role="alert">
          <Text style={[styles.small, { color: p.danger, flex: 1 }]}>The tutor couldn't answer.</Text>
          <Pressable role="button" onPress={onRetry} style={styles.link}>
            <Text style={[styles.linkText, { color: p.accentInk }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Reply({ text, hits, onOpenSource }: { text: string; hits: Hit[]; onOpenSource: OpenSource }) {
  const p = usePalette();
  const blocks = useMemo(() => parseReply(text), [text]);
  const sources = useMemo(() => sourcesByChapter(citedHits(text, hits)), [text, hits]);
  const open = (n: number) => {
    const hit = hits.find((h) => h.n === n);
    if (hit) onOpenSource(hit);
  };
  return (
    <View style={styles.reply}>
      <Blocks blocks={blocks} look={{ size: 15, lineHeight: 1.55, family: font.ui, palette: p, onCite: open }} />
      {sources.length ? (
        <View style={styles.sources} role="list" aria-label="Sources">
          {sources.map(({ hit, ns }) => (
            <Pressable
              key={hit.chapterId}
              role="link"
              accessibilityLabel={`Open ${shortTitle(hit.title)}`}
              onPress={() => onOpenSource(hit)}
              style={({ hovered }) => [styles.source, { borderColor: p.borderStrong, backgroundColor: hovered ? p.raised : 'transparent' }]}
            >
              <Text style={[styles.sourceN, { color: p.accentInk }]}>{ns.join(' ')}</Text>
              <Text style={[styles.small, { color: p.body }]} numberOfLines={1}>
                {shortTitle(hit.title)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ToolCard({ item, onAsk }: { item: Extract<Item, { kind: 'tool' }>; onAsk: (prompt: string) => void }) {
  const p = usePalette();
  const { card, pending } = item;
  switch (card.kind) {
    case 'search':
      return pending || !card.hits ? (
        pending ? <Working label={`Searching the course for “${card.query}”…`} /> : null
      ) : (
        <Text style={[styles.small, { color: p.muted }]}>Searched the course for “{card.query}”</Text>
      );
    case 'flow':
      if (pending) return <Working label="Drawing it as a movie…" />;
      if (!card.diagram?.source) return null;
      return <Diagrams diagrams={[{ id: item.id, kind: card.diagram.kind, title: card.diagram.title, source: card.diagram.source }]} startOpen />;
    case 'quiz':
      if (pending) return <Working label="Writing questions…" />;
      if (!card.questions?.length) return null;
      return <Quiz title="Quick quiz" questions={card.questions.map((q, i) => ({ ...q, id: `${item.id}-${i}` }))} onAskWhy={onAsk} />;
    case 'other':
      return pending ? <Working label="Working…" /> : null;
  }
}

function Working({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={styles.working}>
      <ActivityIndicator size="small" color={p.accentInk} />
      <Text style={[styles.small, { color: p.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '86%', gap: 6 },
  about: { fontFamily: font.ui, fontSize: 12 },
  bubble: { fontFamily: font.ui, fontSize: 15, lineHeight: 21, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: 6 },
  reply: { gap: space.md },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, maxWidth: '100%' },
  sourceN: { fontFamily: font.mono, fontSize: 12, fontWeight: '600' },
  small: { fontFamily: font.ui, fontSize: 13, lineHeight: 19 },
  working: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  linkText: { fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
});
