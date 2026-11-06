/**
 * Draws a Mermaid diagram to SVG on the client (mermaid loads lazily; it is large).
 * `securityLevel: 'strict'` keeps a generated diagram from running scripts or links. The theme
 * follows the reading theme, and a syntax slip shows the diagram's text instead of a parser dump.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePalette, useSettings } from '../settings';
import { font, radius, space } from '../theme';

export function Mermaid({ source }: { source: string }) {
  const p = usePalette();
  const theme = useSettings((s) => s.theme);
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const scratch = useRef<HTMLElement>(null);
  const target = useRef<HTMLElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        // Mermaid lays the diagram out in a scratch element; without ours it uses <body> and the page scrolls.
        if (cancelled || !scratch.current) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'neutral' });
        const out = await mermaid.render(id, source, scratch.current);
        if (cancelled || !target.current) return;
        target.current.innerHTML = out.svg;
        const svg = target.current.querySelector('svg');
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
        }
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [id, source, theme]);

  if (state === 'error') {
    return (
      <View style={styles.gap}>
        <Text style={[styles.note, { color: p.muted }]}>This diagram has a syntax error, so here is its text.</Text>
        <View style={[styles.code, { backgroundColor: p.codeGround, borderColor: p.border }]}>
          <ScrollView horizontal>
            <Text style={[styles.mono, { color: p.body }]}>{source}</Text>
          </ScrollView>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <View ref={scratch} style={styles.scratch} aria-hidden />
      {state === 'loading' ? <View style={[styles.placeholder, { backgroundColor: p.raised }]} /> : null}
      <View ref={target} style={state === 'ready' ? styles.svg : styles.hidden} role="img" aria-label="Diagram" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  scratch: { position: 'absolute', width: '100%', height: 0, overflow: 'hidden', visibility: 'hidden' },
  placeholder: { height: 220, borderRadius: 12 },
  svg: { alignItems: 'center', width: '100%' },
  hidden: { display: 'none' },
  gap: { gap: space.sm },
  note: { fontFamily: font.ui, fontSize: 14, lineHeight: 20 },
  code: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 20, whiteSpace: 'pre' },
});
