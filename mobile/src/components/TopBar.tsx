/**
 * The reader's top bar and its icon buttons. Icons are inline stroke SVG (react-native-web renders
 * DOM, so an <svg> is fine) and every icon-only button carries a label.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../settings';
import { font, space, touch } from '../theme';

const ICONS = {
  back: 'M15 6l-6 6 6 6',
  outline: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  close: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronUp: 'M6 15l6-6 6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12zM9 11h6M9 14h4',
  check: 'M5 12l5 5 9-10',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color, stroke = 2 }: { name: IconName; size?: number; color: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
      {name === 'sliders' ? (
        <>
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </>
      ) : null}
    </svg>
  );
}

export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable role="button" accessibilityLabel={label} onPress={onPress} style={({ pressed, hovered }) => [styles.icon, (pressed || hovered) && styles.hover]}>
      {children}
    </Pressable>
  );
}

/** "Aa": the reading-settings button, drawn in the reading face so it previews what it changes. */
export function SettingsButton({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  return (
    <IconButton label="Reading settings" onPress={onPress}>
      <Text style={{ fontFamily: font.reading, fontSize: 19, color: p.text }}>Aa</Text>
    </IconButton>
  );
}

export function TopBar({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>{center}</View>
      <View style={[styles.side, styles.end]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, minHeight: 56 },
  side: { minWidth: touch * 2, flexDirection: 'row', alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  icon: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },
  hover: { opacity: 0.7 },
});
