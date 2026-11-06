/**
 * Reading settings. Every control applies on change, the sample paragraph shows the result live,
 * and Done goes back to wherever you came from.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCourses } from '../queries';
import { back, href } from '../router';
import {
  lineHeights,
  SIZE_MAX,
  SIZE_MIN,
  usePalette,
  useSettings,
  type Spacing,
  type Typeface,
} from '../settings';
import { font, palettes, radius, readingWidth, space, touch, type ThemeName } from '../theme';
import { TopBar } from '../components/TopBar';

const THEMES: { id: ThemeName; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'sepia', label: 'Sepia' },
];
const FACES: { id: Typeface; label: string }[] = [
  { id: 'serif', label: 'Serif' },
  { id: 'sans', label: 'Sans' },
];
const SPACINGS: { id: Spacing; label: string }[] = [
  { id: 'tight', label: 'Tight' },
  { id: 'normal', label: 'Normal' },
  { id: 'loose', label: 'Loose' },
];

export function SettingsScreen() {
  const p = usePalette();
  const s = useSettings();
  const server = useCourses();
  const family = s.typeface === 'serif' ? font.reading : font.ui;

  return (
    <View style={{ flex: 1, backgroundColor: p.ground }}>
      <TopBar
        left={
          <Text role="heading" aria-level={1} style={[styles.h1, { color: p.text }]}>
            Reading
          </Text>
        }
        right={
          <Pressable
            role="button"
            onPress={() => back(href({ name: 'library' }))}
            style={({ hovered }) => [styles.done, hovered && { opacity: 0.75 }]}
          >
            <Text style={[styles.doneText, { color: p.accentInk }]}>Done</Text>
          </Pressable>
        }
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
        <View
          style={[styles.sample, { backgroundColor: p.surface, borderColor: p.border }]}
          aria-label="Sample paragraph"
        >
          <Text
            style={{
              color: p.body,
              fontFamily: family,
              fontSize: s.size,
              lineHeight: Math.round(s.size * lineHeights[s.spacing]),
            }}
          >
            Think of a maths exam where you may do rough work in the margin. The examiner can look
            at it to see how you got there.
          </Text>
        </View>

        <Group title="Text size" aside={`${s.size} px`}>
          <View style={styles.sizeRow}>
            <Text style={[styles.a, { color: p.muted, fontSize: 14 }]} aria-hidden>
              A
            </Text>
            <input
              type="range"
              min={SIZE_MIN}
              max={SIZE_MAX}
              step={1}
              value={s.size}
              aria-label="Text size"
              onChange={e => s.set({ size: Number(e.currentTarget.value) })}
              className="cw-range"
              style={
                {
                  flex: 1,
                  height: touch,
                  margin: 0,
                  '--track': p.borderStrong,
                  '--fill': p.meter,
                  '--thumb': p.text,
                  '--pct': `${((s.size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100}%`,
                } as React.CSSProperties
              }
            />
            <Text style={[styles.a, { color: p.muted, fontSize: 24 }]} aria-hidden>
              A
            </Text>
          </View>
          <Text style={[styles.note, { color: p.muted }]}>
            Starts from your device's text size.
          </Text>
        </Group>

        <Group title="Theme">
          <View style={styles.themes}>
            {THEMES.map(t => {
              const tp = palettes[t.id];
              const on = s.theme === t.id;
              return (
                <Pressable
                  key={t.id}
                  role="button"
                  aria-pressed={on}
                  onPress={() => s.set({ theme: t.id })}
                  style={[
                    styles.theme,
                    {
                      backgroundColor: tp.ground,
                      borderColor: on ? p.accentInk : p.borderStrong,
                      borderWidth: on ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontFamily: font.reading, fontSize: 20, color: tp.text }}>Aa</Text>
                  <Text style={{ fontFamily: font.ui, fontSize: 12, color: tp.text }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Group>

        <Group title="Typeface">
          <Segmented
            options={FACES}
            value={s.typeface}
            onChange={typeface => s.set({ typeface })}
            fontFor={id => (id === 'serif' ? font.reading : font.ui)}
          />
        </Group>

        <Group title="Line spacing">
          <Segmented
            options={SPACINGS}
            value={s.spacing}
            onChange={spacing => s.set({ spacing })}
          />
        </Group>

        <View style={[styles.status, { backgroundColor: p.surface }]}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: server.isSuccess
                  ? p.accentInk
                  : server.isError
                    ? p.danger
                    : p.muted,
              },
            ]}
            aria-hidden
          />
          <Text style={[styles.statusText, { color: p.text }]}>
            {server.isSuccess
              ? 'Connected to your server'
              : server.isError
                ? "Can't reach your server"
                : 'Checking your server…'}
          </Text>
        </View>
        <Text style={[styles.note, { color: p.muted }]}>
          Making a course or reading your notes happens in the full app.{' '}
          <Text href="/?app=full" style={{ color: p.accentInk, textDecorationLine: 'underline' }}>
            Open the full app
          </Text>{' '}
          for this visit; the reader opens again next time.
        </Text>
        {!s.remembered ? (
          <Text style={[styles.note, { color: p.muted }]}>
            This browser won't let the reader save settings, so they last until you close it.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Group({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.group} role="group" aria-label={title}>
      <View style={styles.groupHead}>
        <Text style={[styles.groupTitle, { color: p.text }]}>{title}</Text>
        {aside ? <Text style={[styles.aside, { color: p.muted }]}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  fontFor,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  fontFor?: (id: T) => string;
}) {
  const p = usePalette();
  return (
    <View style={[styles.segments, { backgroundColor: p.surface }]}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            role="button"
            aria-pressed={on}
            onPress={() => onChange(o.id)}
            style={[styles.segment, on && { backgroundColor: p.borderStrong }]}
          >
            <Text
              style={{
                fontFamily: fontFor?.(o.id) ?? font.ui,
                fontSize: 15,
                color: on ? p.text : p.muted,
                fontWeight: on ? '500' : '400',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: font.ui, fontSize: 24, fontWeight: '600', paddingLeft: space.md },
  done: { minHeight: touch, paddingHorizontal: space.md, justifyContent: 'center' },
  doneText: { fontFamily: font.ui, fontSize: 16, fontWeight: '600' },
  page: {
    width: '100%',
    maxWidth: readingWidth,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: 48,
    gap: 26,
  },
  sample: { borderWidth: 1, borderRadius: radius.lg, padding: space.xl },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  groupTitle: { fontFamily: font.ui, fontSize: 15, fontWeight: '500' },
  aside: { fontFamily: font.mono, fontSize: 13 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  a: { fontFamily: font.reading },
  note: { fontFamily: font.ui, fontSize: 13, lineHeight: 18 },
  themes: { flexDirection: 'row', gap: 10 },
  theme: {
    flex: 1,
    height: 76,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segments: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  segment: {
    flex: 1,
    minHeight: touch,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: font.ui, fontSize: 15 },
});
