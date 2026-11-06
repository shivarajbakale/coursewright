/**
 * Renders the parsed chapter with React Native components, in the reader's current settings.
 * Code and tables scroll sideways inside their own box and never wrap or widen the page.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Style } from 'react-native';
import { font, radius, space, type Palette } from '../theme';
import { plainText, type Block, type Inline } from './parse';
import { Inkling } from '../diagrams/Inkling';

export type Look = {
  size: number;
  lineHeight: number;
  family: string;
  palette: Palette;
  /** Tutor replies: a tapped `[n]` citation. */
  onCite?: (n: number) => void;
  /** Chapters: a tapped paragraph, as plain text, to ask the tutor about. */
  onParagraph?: (text: string) => void;
  /** The paragraph currently picked for the tutor. */
  selected?: string | null;
};

export function Blocks({ blocks, look }: { blocks: Block[]; look: Look }) {
  return (
    <View style={styles.stack}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} look={look} />
      ))}
    </View>
  );
}

function BlockView({ block, look }: { block: Block; look: Look }) {
  const { palette: p, size, lineHeight, family } = look;
  const body: Style = { color: p.body, fontFamily: family, fontSize: size, lineHeight: Math.round(size * lineHeight) };

  switch (block.kind) {
    case 'heading': {
      const scale = block.level <= 2 ? 1.3 : block.level === 3 ? 1.12 : 1;
      const fontSize = Math.round(size * scale);
      return (
        <Text
          role="heading"
          aria-level={block.level}
          style={[body, { color: p.text, fontFamily: font.reading, fontSize, lineHeight: Math.round(fontSize * 1.3), fontWeight: '600', marginTop: space.md }]}
        >
          <Runs inlines={block.inlines} look={look} />
        </Text>
      );
    }
    case 'paragraph': {
      if (!look.onParagraph) {
        return (
          <Text style={body}>
            <Runs inlines={block.inlines} look={look} />
          </Text>
        );
      }
      const words = plainText(block.inlines);
      const picked = look.selected === words;
      const pick = look.onParagraph;
      return (
        <Text
          style={[body, styles.tappable, picked && { backgroundColor: p.tint, borderColor: p.accentInk }]}
          onPress={() => pick(words)}
          aria-pressed={picked}
          accessibilityLabel={picked ? 'Picked for the tutor. Tap again to unpick.' : undefined}
        >
          <Runs inlines={block.inlines} look={look} />
        </Text>
      );
    }
    case 'list':
      return (
        <View style={styles.list} role="list">
          {block.items.map((item, i) => (
            <View key={i} style={styles.item} role="listitem">
              <Text style={[body, styles.marker, { color: p.muted }]} aria-hidden>
                {block.ordered ? `${block.start + i}.` : '•'}
              </Text>
              <View style={styles.itemBody}>
                {item.map((b, j) => (
                  <BlockView key={j} block={b} look={look} />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    case 'code':
      return <CodeBlock text={block.text} lang={block.lang} palette={p} />;
    case 'inkling':
      return <Inkling source={block.source} />;
    case 'quote':
      if (block.keyIdea) return <KeyIdea block={block} look={look} />;
      return (
        <View style={[styles.quote, { borderLeftColor: p.borderStrong }]}>
          {block.blocks.map((b, i) => (
            <BlockView key={i} block={b} look={{ ...look, palette: { ...p, body: p.muted } }} />
          ))}
        </View>
      );
    case 'table':
      return (
        <View style={[styles.box, { borderColor: p.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View role="table">
              <View role="row" style={[styles.tr, { backgroundColor: p.surface, borderBottomColor: p.border }]}>
                {block.header.map((cell, i) => (
                  <Text key={i} role="columnheader" style={[styles.cell, { color: p.text, fontWeight: '600' }]}>
                    <Runs inlines={cell} look={look} />
                  </Text>
                ))}
              </View>
              {block.rows.map((row, r) => (
                <View key={r} role="row" style={[styles.tr, { borderBottomColor: p.border }]}>
                  {row.map((cell, i) => (
                    <Text key={i} role="cell" style={[styles.cell, { color: p.body }]}>
                      <Runs inlines={cell} look={look} />
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    case 'rule':
      return <View style={[styles.rule, { backgroundColor: p.border }]} />;
  }
}

/**
 * Code keeps its lines (it never wraps) and scrolls sideways. A line that runs past the edge would
 * look complete, so while more is hidden to the right the edge fades and a "scroll" hint shows.
 */
function CodeBlock({ text, lang, palette: p }: { text: string; lang: string; palette: Palette }) {
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const [x, setX] = useState(0);
  const more = content - box - x > 4;
  return (
    <View style={[styles.box, { backgroundColor: p.codeGround, borderColor: p.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.codeScroll}
        onLayout={(e) => setBox(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContent(w)}
        scrollEventThrottle={32}
        onScroll={(e) => setX(e.nativeEvent.contentOffset.x)}
      >
        <Text style={[styles.code, { color: p.body }]} aria-label={lang ? `${lang} code` : 'code'}>
          {text}
        </Text>
      </ScrollView>
      {more ? (
        <View pointerEvents="none" aria-hidden style={[styles.fade, { backgroundImage: `linear-gradient(to right, transparent, ${p.codeGround} 70%)` }]}>
          <Text style={[styles.more, { color: p.muted }]}>scroll ›</Text>
        </View>
      ) : null}
    </View>
  );
}

/** `> **Key idea:** ...` becomes a labelled callout; the label replaces the bold lead-in. */
function KeyIdea({ block, look }: { block: Extract<Block, { kind: 'quote' }>; look: Look }) {
  const p = look.palette;
  const [first, ...rest] = block.blocks;
  const lead = first?.kind === 'paragraph' ? first.inlines.slice(1) : [];
  if (lead[0]) lead[0] = { ...lead[0], text: lead[0].text.replace(/^\s+/, '') };
  return (
    <View style={[styles.callout, { backgroundColor: p.tint, borderColor: p.border }]} role="note" aria-label="Key idea">
      <Text style={[styles.calloutLabel, { color: p.accentInk }]}>Key idea</Text>
      <Text style={{ color: p.text, fontFamily: look.family, fontSize: look.size, lineHeight: Math.round(look.size * look.lineHeight), fontWeight: '500' }}>
        <Runs inlines={lead} look={look} />
      </Text>
      {rest.map((b, i) => (
        <BlockView key={i} block={b} look={look} />
      ))}
    </View>
  );
}

export function Runs({ inlines, look }: { inlines: Inline[]; look: Look }) {
  const p = look.palette;
  return (
    <>
      {inlines.map((r, i) => {
        const style: Style = {};
        if (r.bold) style.fontWeight = '600';
        if (r.italic) style.fontStyle = 'italic';
        // No side padding: a padded chip that wraps across lines breaks into slabs and pokes past the text edge.
        if (r.code) Object.assign(style, { fontFamily: font.mono, fontSize: Math.round(look.size * 0.84), backgroundColor: p.raised, color: p.text, borderRadius: 3 });
        if (r.cite !== undefined) {
          const n = r.cite;
          return (
            <Text
              key={i}
              role={look.onCite ? 'link' : undefined}
              accessibilityLabel={`Source ${n}`}
              onPress={look.onCite ? () => look.onCite?.(n) : undefined}
              style={[styles.cite, { color: p.accentInk, backgroundColor: p.tint, borderColor: p.border }]}
            >
              {n}
            </Text>
          );
        }
        if (r.href) {
          return (
            <Text key={i} href={r.href} hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }} style={[style, { color: p.accentInk, textDecorationLine: 'underline' }]}>
              {r.text}
            </Text>
          );
        }
        return (
          <Text key={i} style={style}>
            {r.text}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 18 },
  list: { gap: space.sm },
  item: { flexDirection: 'row', gap: space.sm },
  marker: { minWidth: 18, textAlign: 'right' },
  itemBody: { flex: 1, minWidth: 0, gap: space.sm },
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  fade: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 72, alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 8, paddingBottom: 6 },
  more: { fontFamily: font.ui, fontSize: 11 },
  codeScroll: { paddingVertical: 14, paddingHorizontal: 16 },
  code: { fontFamily: font.mono, fontSize: 13, lineHeight: 21, whiteSpace: 'pre' },
  quote: { borderLeftWidth: 3, paddingLeft: space.lg, gap: space.sm },
  callout: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  calloutLabel: { fontFamily: font.ui, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1 },
  cell: { width: 160, paddingVertical: 10, paddingHorizontal: 12, fontFamily: font.ui, fontSize: 14, lineHeight: 20 },
  rule: { height: 1, marginVertical: space.sm },
  // A paragraph you can tap: a transparent frame that tints when picked, so picking never shifts the text.
  tappable: { borderRadius: 8, borderWidth: 1, borderColor: 'transparent', marginHorizontal: -9, paddingHorizontal: 8, cursor: 'pointer' },
  cite: { fontFamily: font.mono, fontSize: 11, fontWeight: '600', borderRadius: 6, borderWidth: 1, paddingHorizontal: 5, marginHorizontal: 2, cursor: 'pointer' },
});
