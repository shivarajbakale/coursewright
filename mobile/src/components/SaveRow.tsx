/**
 * "On this device" for one course: Save for offline (every chapter, its drawings and quiz), progress
 * while saving with Stop, then the count and size with Remove. Chapters you open are kept anyway; this
 * is for before a trip. Hidden where there is no service worker to save into (plain http).
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CourseDetail } from '@/api/types';
import { usePalette } from '../settings';
import { font, radius, space, touch } from '../theme';
import { useOnline } from '../offline/online';
import { canSave, formatBytes, removeCourse, saveCourse, useSavedCourses, type SaveProgress } from '../offline/saved';

export function SaveRow({ course }: { course: CourseDetail }) {
  const p = usePalette();
  const online = useOnline();
  const saved = useSavedCourses()[course.id];
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const stop = useRef<AbortController | null>(null);
  if (!canSave()) return null;

  const save = async () => {
    setProblem(null);
    stop.current = new AbortController();
    try {
      const p = await saveCourse(course, setProgress, stop.current.signal);
      if (p.failed) setProblem(`Saved ${p.done - p.failed} of ${p.total}. Some chapters didn't download.`);
    } catch {
      setProblem('This device is out of space for courses.');
    } finally {
      setProgress(null);
      stop.current = null;
    }
  };

  const total = course.modules.reduce((n, m) => n + m.chapters.length, 0);
  let line: string;
  let actions: { label: string; onPress: () => void; primary?: boolean }[] = [];
  if (progress) {
    line = `Saving ${progress.done} of ${progress.total} chapters…`;
    actions = [{ label: 'Stop', onPress: () => stop.current?.abort() }];
  } else if (confirm && saved) {
    line = `Remove the saved course? Frees ${formatBytes(saved.bytes)}. Your progress stays.`;
    actions = [
      { label: 'Cancel', onPress: () => setConfirm(false) },
      { label: 'Remove', primary: true, onPress: () => void removeCourse(course.id).then(() => setConfirm(false)) },
    ];
  } else if (saved) {
    const all = saved.chapterIds.length >= total;
    line = `${all ? 'Saved' : `Saved ${saved.chapterIds.length} of ${total}`} · ${formatBytes(saved.bytes)}`;
    actions = [
      ...(!all && online ? [{ label: 'Save the rest', onPress: () => void save() }] : []),
      { label: 'Remove', onPress: () => setConfirm(true) },
    ];
  } else {
    line = online ? 'Chapters you open are kept on this device.' : 'Not saved on this device.';
    if (online) actions = [{ label: 'Save for offline', primary: true, onPress: () => void save() }];
  }

  return (
    <View role="region" aria-label="On this device" style={[styles.row, { borderColor: p.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.line, { color: p.text }]} aria-live="polite">
          {line}
        </Text>
        {problem ? (
          <Text style={[styles.problem, { color: p.danger }]} role="alert">
            {problem}
          </Text>
        ) : null}
      </View>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          role="button"
          onPress={a.onPress}
          style={[styles.button, a.primary ? { backgroundColor: p.accent } : { borderColor: p.borderStrong, borderWidth: 1 }]}
        >
          <Text style={[styles.label, { color: a.primary ? p.onAccent : p.text }]}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, borderTopWidth: 1, paddingTop: space.md },
  line: { fontFamily: font.ui, fontSize: 14, lineHeight: 20 },
  problem: { fontFamily: font.ui, fontSize: 13, lineHeight: 18 },
  button: { minHeight: touch, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.ui, fontSize: 14, fontWeight: '600' },
});
