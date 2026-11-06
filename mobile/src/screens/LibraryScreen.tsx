/**
 * Library: the Continue card (resume the last chapter you opened, where you stopped) and every
 * course with its progress. Courses are made on the desktop app, so this screen has no "new".
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CourseSummary } from '@/api/types';
import { chapterNumber, useCourse, useCourses } from '../queries';
import { href, navigate } from '../router';
import { usePalette } from '../settings';
import { font, radius, readingWidth, space, touch } from '../theme';
import { Message, Skeleton } from '../components/States';
import { Icon, IconButton } from '../components/TopBar';

function percent(c: CourseSummary): number {
  return c.chapterCount ? Math.round((c.chaptersDone / c.chapterCount) * 100) : 0;
}

export function LibraryScreen() {
  const p = usePalette();
  const courses = useCourses();
  const ready = (courses.data ?? []).filter((c) => c.status === 'ready');
  const resume = ready.find((c) => c.lastOpenedChapterId) ?? null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.ground }} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: p.accent }]} aria-hidden>
            <Text style={[styles.markText, { color: p.onAccent }]}>C</Text>
          </View>
          <Text style={[styles.brandText, { color: p.text }]}>Coursewright</Text>
        </View>
        <IconButton label="Reading settings" onPress={() => navigate(href({ name: 'settings' }))}>
          <Icon name="sliders" color={p.muted} />
        </IconButton>
      </View>

      <Text role="heading" aria-level={1} style={[styles.h1, { color: p.text }]}>
        Your courses
      </Text>

      {courses.isPending ? (
        <View style={styles.gap}>
          <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Skeleton lines={4} height={18} />
          </View>
          <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Skeleton lines={3} height={44} />
          </View>
        </View>
      ) : courses.isError ? (
        <Message tone="error" title="Couldn't reach your server." body="Check that Tailscale is on, then try again." action="Try again" onAction={() => void courses.refetch()} />
      ) : (courses.data ?? []).length === 0 ? (
        <Message title="No courses yet." body="Make one in the desktop app; it appears here when it is ready." />
      ) : (
        <View style={styles.gap}>
          {resume ? <ContinueCard course={resume} /> : null}
          <Text style={[styles.section, { color: p.muted }]}>All courses</Text>
          <View role="list" style={[styles.list, { backgroundColor: p.surface, borderColor: p.border }]}>
            {(courses.data ?? []).map((c, i) => (
              <CourseRow key={c.id} course={c} last={i === (courses.data ?? []).length - 1} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ContinueCard({ course }: { course: CourseSummary }) {
  const p = usePalette();
  const detail = useCourse(course.id);
  const chapterId = course.lastOpenedChapterId as string;
  const chapter = detail.data?.modules.flatMap((m) => m.chapters).find((c) => c.id === chapterId);
  const where = chapterNumber(detail.data, chapterId);
  const go = () => navigate(href({ name: 'chapter', courseId: course.id, chapterId }));

  return (
    <View role="region" aria-label="Continue reading" style={[styles.card, styles.continue, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text style={[styles.kicker, { color: p.accentInk }]}>Continue reading</Text>
      <View style={styles.tight}>
        <Text style={[styles.small, { color: p.muted }]}>{course.title}</Text>
        {chapter ? (
          <Text style={[styles.chapterTitle, { color: p.text }]}>{chapter.title}</Text>
        ) : (
          <Skeleton lines={1} height={24} />
        )}
        {where ? (
          <Text style={[styles.small, { color: p.muted }]}>
            Chapter {where.n} of {where.total}
            {chapter ? ` · about ${chapter.readingMinutes} min` : ''}
          </Text>
        ) : null}
      </View>
      <Bar value={percent(course)} />
      <Pressable role="link" onPress={go} style={({ pressed, hovered }) => [styles.primary, { backgroundColor: p.accent }, (pressed || hovered) && styles.pressed]}>
        <Text style={[styles.primaryText, { color: p.onAccent }]}>Resume</Text>
        <Icon name="arrowRight" size={18} color={p.onAccent} stroke={2.2} />
      </Pressable>
    </View>
  );
}

function CourseRow({ course, last }: { course: CourseSummary; last: boolean }) {
  const p = usePalette();
  const ready = course.status === 'ready';
  const to = href({ name: 'course', courseId: course.id });
  return (
    <Pressable
      role="link"
      disabled={!ready}
      onPress={() => navigate(to)}
      accessibilityLabel={`${course.title}, ${ready ? `${percent(course)}% read` : 'still building'}`}
      style={({ hovered }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: p.border }, hovered && ready && { backgroundColor: p.raised }]}
    >
      <View style={[styles.pct, { backgroundColor: p.raised }]}>
        <Text style={[styles.pctText, { color: ready ? p.accentInk : p.muted }]}>{ready ? `${percent(course)}%` : '…'}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: ready ? p.text : p.muted }]}>{course.title}</Text>
        <Text style={[styles.small, { color: p.muted }]}>{ready ? `${course.moduleCount} modules · ${course.chapterCount} lessons` : 'Building…'}</Text>
      </View>
      {ready ? <Icon name="chevronRight" size={18} color={p.muted} /> : null}
    </Pressable>
  );
}

export function Bar({ value, thin = false }: { value: number; thin?: boolean }) {
  const p = usePalette();
  const h = thin ? 3 : 6;
  return (
    <View role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} style={{ height: h, borderRadius: h / 2, backgroundColor: p.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: h, backgroundColor: p.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: readingWidth, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: 48, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: font.reading, fontWeight: '600', fontSize: 17 },
  brandText: { fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
  h1: { fontFamily: font.ui, fontSize: 30, fontWeight: '600', letterSpacing: -0.6, paddingLeft: space.xs },
  gap: { gap: space.lg },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.xl },
  continue: { gap: 14 },
  kicker: { fontFamily: font.ui, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  tight: { gap: 6 },
  small: { fontFamily: font.ui, fontSize: 13, lineHeight: 18 },
  chapterTitle: { fontFamily: font.reading, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  primary: { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  primaryText: { fontFamily: font.ui, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  section: { fontFamily: font.ui, fontSize: 13, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: space.sm, paddingLeft: space.xs },
  list: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: space.lg, minHeight: touch + 28 },
  pct: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pctText: { fontFamily: font.mono, fontSize: 13 },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontFamily: font.ui, fontSize: 16, fontWeight: '500', lineHeight: 21 },
});
