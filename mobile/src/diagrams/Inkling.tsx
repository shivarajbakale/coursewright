/**
 * A lesson's Inkling explainer in the reader: the hand-drawn drawing, inline after the paragraph it
 * pictures, on the reading theme's paper (chalkboard, notebook or napkin). It draws itself the first time
 * it scrolls into view (not under reduced motion) and scales to the reading column, never scrolling
 * sideways; the bar under it steps through with each step's caption. The library loads on first use.
 *
 * The expand button opens it full screen, drawn as large as the screen allows (`fill`).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { inklingTitle, mountExplainer, paperFor, type Explainer, type ExplainerState } from '@/lib/inkling';
import { usePalette, useSettings } from '../settings';
import { font, radius, space, touch } from '../theme';
import { Icon, type IconName } from '../components/TopBar';

export function Inkling({ source, fill = false }: { source: string; fill?: boolean }) {
  const p = usePalette();
  const theme = useSettings((s) => s.theme);
  const host = useRef<HTMLElement>(null);
  const control = useRef<Explainer | null>(null);
  const [state, setState] = useState<ExplainerState | null>(null);
  const [failed, setFailed] = useState(false);
  const [large, setLarge] = useState(false);
  const title = inklingTitle(source);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let mounted: Explainer | null = null;
    setFailed(false);
    setState(null);
    // react-native-web owns the View's own node, so the drawing goes in a plain child div (lib/inkling).
    mountExplainer(el, source, paperFor(theme), (s) => !cancelled && setState(s), { fill })
      .then((c) => {
        if (cancelled) c.destroy();
        else control.current = mounted = c;
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      mounted?.destroy();
      control.current = null;
    };
  }, [source, theme, fill]);

  // Full screen: Escape closes it (handled by the opener), the arrow keys step through.
  useEffect(() => {
    if (!fill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') control.current?.next();
      else if (e.key === 'ArrowLeft') control.current?.prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fill]);

  useEffect(() => {
    if (!large) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLarge(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [large]);

  if (failed) {
    return (
      <View style={styles.gap}>
        <Text style={[styles.note, { color: p.muted }]}>{title ? `“${title}” has a mistake` : 'This drawing has a mistake'}, so here is its text.</Text>
        <View style={[styles.code, { backgroundColor: p.codeGround, borderColor: p.border }]}>
          <ScrollView horizontal>
            <Text style={[styles.mono, { color: p.body }]}>{source}</Text>
          </ScrollView>
        </View>
      </View>
    );
  }

  const steps = state?.steps.length ?? 0;
  const caption = state && steps ? state.steps[state.step]?.caption : '';
  const button = (icon: IconName, label: string, onPress: () => void, disabled = false) => (
    <Pressable role="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.off]}>
      <Icon name={icon} size={18} color={p.text} />
    </Pressable>
  );

  return (
    <View style={styles.gap}>
      {!state ? (
        <View style={[styles.placeholder, { backgroundColor: p.raised }]}>
          <Text style={[styles.note, { color: p.muted }]}>{title || 'Drawing'}…</Text>
        </View>
      ) : null}
      <View ref={host} style={[styles.stage, !state && styles.hidden]} />
      {state ? (
        <View style={styles.bar}>
          <Text style={[styles.caption, { color: p.muted }]} aria-live="polite">
            {steps > 1 ? (caption ? `${state.step + 1}. ${caption}` : `Step ${state.step + 1} of ${steps}`) : ''}
          </Text>
          {steps > 1 ? (
            <>
              {button('back', 'Previous step', () => control.current?.prev(), state.step === 0 && !state.playing)}
              {button(state.playing ? 'pause' : state.done ? 'replay' : 'play', state.playing ? 'Pause' : state.done ? 'Draw it again' : 'Play', () =>
                state.playing ? control.current?.pause() : control.current?.play(),
              )}
              {button('chevronRight', 'Next step', () => control.current?.next(), state.done && !state.playing)}
            </>
          ) : null}
          {!fill ? button('expand', 'Open full screen', () => setLarge(true)) : null}
        </View>
      ) : null}
      {!fill ? (
        large ? createPortal(
          <View role="dialog" aria-modal aria-label={title || 'Drawing'} style={[styles.full, { backgroundColor: p.ground }]}>
            <View style={styles.fullBar}>
              <Text style={[styles.fullTitle, { color: p.text }]} numberOfLines={1}>
                {title || 'Drawing'}
              </Text>
              {button('close', 'Close full screen', () => setLarge(false))}
            </View>
            <ScrollView contentContainerStyle={styles.fullBody}>
              <Inkling source={source} fill />
            </ScrollView>
          </View>,
          document.body,
        ) : null
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  stage: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  hidden: { display: 'none' },
  placeholder: { height: 240, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  note: { fontFamily: font.ui, fontSize: 14, lineHeight: 20 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  caption: { flex: 1, fontFamily: font.ui, fontSize: 14, lineHeight: 20, paddingRight: space.sm },
  button: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  code: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 19 },
  // react-native-web: a fixed layer over the whole reader, like a native full-screen modal.
  full: { position: 'fixed' as 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000 },
  fullBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm },
  fullTitle: { flex: 1, fontFamily: font.ui, fontSize: 17, fontWeight: '600' },
  fullBody: { flexGrow: 1, justifyContent: 'center', padding: space.md },
});
