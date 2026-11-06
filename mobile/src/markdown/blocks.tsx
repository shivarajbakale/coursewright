/**
 * Renders the parsed chapter with React Native components, in the reader's current settings.
 * Code and tables scroll sideways inside their own box and never wrap or widen the page.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Style } from 'react-native';
import { font, radius, space, type Palette } from '../theme';
import type { Block, Inline } from './parse';

export type Look = { size: number; lineHeight: number; family: string; palette: Palette };

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
    case 'paragraph':
      return (
        <Text style={body}>
          <Runs inlines={block.inlines} look={look} />
        </Text>
      );
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
      return (
        <View style={[styles.box, { backgroundColor: p.codeGround, borderColor: p.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.codeScroll}>
            <Text style={[styles.code, { color: p.body }]} aria-label={block.lang ? `${block.lang} code` : 'code'}>
              {block.text}
            </Text>
          </ScrollView>
        </View>
      );
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

function Runs({ inlines, look }: { inlines: Inline[]; look: Look }) {
  const p = look.palette;
  return (
    <>
      {inlines.map((r, i) => {
        const style: Style = {};
        if (r.bold) style.fontWeight = '600';
        if (r.italic) style.fontStyle = 'italic';
        if (r.code) Object.assign(style, { fontFamily: font.mono, fontSize: Math.round(look.size * 0.84), backgroundColor: p.raised, color: p.text, borderRadius: 5, paddingHorizontal: 4 });
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
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  codeScroll: { paddingVertical: 14, paddingHorizontal: 16 },
  code: { fontFamily: font.mono, fontSize: 13, lineHeight: 21, whiteSpace: 'pre' },
  quote: { borderLeftWidth: 3, paddingLeft: space.lg, gap: space.sm },
  callout: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  calloutLabel: { fontFamily: font.ui, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1 },
  cell: { width: 160, paddingVertical: 10, paddingHorizontal: 12, fontFamily: font.ui, fontSize: 14, lineHeight: 20 },
  rule: { height: 1, marginVertical: space.sm },
});
