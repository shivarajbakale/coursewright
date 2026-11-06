/**
 * A course's modules and chapters. The module holding the current chapter (or the first unfinished
 * one) starts open; the rest fold to one row with a done count, so a 65-lesson course stays short.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CourseDetail, ModuleOut } from '@/api/types';
import { usePalette } from '../settings';
import { font, radius, space, touch } from '../theme';
import { useOnline } from '../offline/online';
import { useChaptersOnDevice } from '../offline/saved';
import { Icon } from './TopBar';
import { shortTitle } from '../courseMath';

function startOpen(course: CourseDetail, currentId: string | null): string | null {
  const holding = course.modules.find(m => m.chapters.some(c => c.id === currentId));
  if (holding) return holding.id;
  return (course.modules.find(m => m.chapters.some(c => !c.done)) ?? course.modules[0])?.id ?? null;
}

/** `compact` is for the iPad sidebar: tighter module rows so titles fit on two lines, not three. */
export function Outline({
  course,
  currentId,
  onOpen,
  compact = false,
}: {
  course: CourseDetail;
  currentId: string | null;
  onOpen: (chapterId: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([startOpen(course, currentId)].filter(Boolean) as string[])
  );
  const toggle = (id: string) =>
    setOpen(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Offline, chapters that are not on this device are dimmed: opening one would only say so.
  const online = useOnline();
  const onDevice = useChaptersOnDevice();
  const away = !online && onDevice ? (id: string) => !onDevice.has(id) : () => false;

  let number = 0;
  return (
    <View style={styles.list} role="list" aria-label="Modules">
      {course.modules.map(m => {
        const first = number + 1;
        number += m.chapters.length;
        return (
          <ModuleRow
            key={m.id}
            module={m}
            first={first}
            open={open.has(m.id)}
            onToggle={() => toggle(m.id)}
            currentId={currentId}
            onOpen={onOpen}
            compact={compact}
            away={away}
          />
        );
      })}
    </View>
  );
}

function ModuleRow({
  module: m,
  first,
  open,
  onToggle,
  currentId,
  onOpen,
  compact,
  away,
}: {
  away: (id: string) => boolean;
  compact: boolean;
  module: ModuleOut;
  first: number;
  open: boolean;
  onToggle: () => void;
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  const p = usePalette();
  const done = m.chapters.filter(c => c.done).length;
  const complete = done === m.chapters.length && done > 0;
  const holdsCurrent = m.chapters.some(c => c.id === currentId);
  return (
    <View
      role="listitem"
      style={[
        styles.module,
        { backgroundColor: p.surface, borderColor: holdsCurrent ? p.accentInk : p.border },
      ]}
    >
      <Pressable
        role="button"
        aria-expanded={open}
        onPress={onToggle}
        style={({ hovered }) => [
          styles.moduleHead,
          compact && styles.moduleHeadCompact,
          hovered && { backgroundColor: p.raised },
        ]}
      >
        <View
          style={[
            styles.badge,
            complete
              ? { backgroundColor: p.tint }
              : {
                  borderColor: holdsCurrent ? p.accentInk : p.borderStrong,
                  borderWidth: holdsCurrent ? 2 : 1,
                },
          ]}
        >
          {complete ? (
            <Icon name="check" size={15} color={p.accentInk} stroke={2.6} />
          ) : (
            <Text style={[styles.badgeText, { color: holdsCurrent ? p.accentInk : p.muted }]}>
              {m.position}
            </Text>
          )}
        </View>
        <Text
          style={[
            styles.moduleTitle,
            compact && styles.moduleTitleCompact,
            { color: p.text, fontWeight: holdsCurrent ? '600' : '500' },
          ]}
        >
          {m.title}
        </Text>
        <Text style={[styles.count, { color: p.muted }]}>
          {done}/{m.chapters.length}
        </Text>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={p.muted} />
      </Pressable>
      {open ? (
        <View style={styles.chapters} role="list">
          {m.chapters.map((c, i) => {
            const current = c.id === currentId;
            const missing = away(c.id);
            return (
              <Pressable
                key={c.id}
                role="link"
                aria-current={current ? 'page' : undefined}
                accessibilityLabel={`${first + i}. ${c.title}${c.done ? ', read' : ''}${missing ? ', not on this device' : ''}`}
                onPress={() => onOpen(c.id)}
                style={({ hovered, pressed }) => [
                  styles.chapter,
                  missing && styles.away,
                  current && { backgroundColor: p.raised },
                  (hovered || pressed) && !current && { backgroundColor: p.raised },
                ]}
              >
                <Text style={[styles.num, { color: current ? p.accentInk : p.muted }]}>
                  {first + i}
                </Text>
                <Text
                  style={[
                    styles.chapterTitle,
                    {
                      color: current ? p.text : c.done ? p.muted : p.body,
                      fontWeight: current ? '500' : '400',
                    },
                  ]}
                >
                  {shortTitle(c.title)}
                </Text>
                {current ? (
                  <Text style={[styles.state, { color: p.accentInk }]}>Reading</Text>
                ) : c.done ? (
                  <Icon name="check" size={14} color={p.accentInk} stroke={2.4} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  away: { opacity: 0.45 },
  moduleHeadCompact: { paddingHorizontal: space.md, gap: 10 },
  moduleTitleCompact: { fontSize: 14, lineHeight: 19 },
  list: { gap: 10 },
  module: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  moduleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    minHeight: touch + 12,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.mono, fontSize: 12 },
  moduleTitle: { flex: 1, fontFamily: font.ui, fontSize: 15, lineHeight: 20 },
  count: { fontFamily: font.mono, fontSize: 12 },
  chapters: { paddingHorizontal: space.sm, paddingBottom: space.sm },
  chapter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  num: { width: 24, fontFamily: font.mono, fontSize: 12 },
  chapterTitle: { flex: 1, fontFamily: font.ui, fontSize: 14, lineHeight: 19 },
  state: { fontFamily: font.ui, fontSize: 12 },
});
