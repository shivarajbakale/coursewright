/**
 * A course's outline as its own screen (phones, and iPads before a chapter is open): title,
 * progress, one button to continue, then the modules.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CourseDetail } from '@/api/types';
import { useCourse } from '../queries';
import { back, href, navigate } from '../router';
import { usePalette } from '../settings';
import { font, radius, readingWidth, space } from '../theme';
import { Outline } from '../components/Outline';
import { Message, Skeleton } from '../components/States';
import { Icon, IconButton, SettingsButton, TopBar } from '../components/TopBar';
import { Bar } from './LibraryScreen';
import { nextUp } from '../courseMath';

export function CourseScreen({ courseId }: { courseId: string }) {
  const p = usePalette();
  const course = useCourse(courseId);
  const open = (chapterId: string) => navigate(href({ name: 'chapter', courseId, chapterId }));

  return (
    <View style={{ flex: 1, backgroundColor: p.ground }}>
      <TopBar
        left={
          <IconButton label="Back to your courses" onPress={() => back(href({ name: 'library' }))}>
            <Icon name="back" color={p.text} />
          </IconButton>
        }
        right={<SettingsButton onPress={() => navigate(href({ name: 'settings' }))} />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
        {course.isPending ? (
          <View style={styles.gap}>
            <Skeleton lines={2} height={28} />
            <Skeleton lines={6} height={56} gap={10} />
          </View>
        ) : course.isError ? (
          <Message tone="error" title="Couldn't load this course." body="Check your connection, then try again." action="Try again" onAction={() => void course.refetch()} />
        ) : (
          <CourseBody course={course.data} onOpen={open} />
        )}
      </ScrollView>
    </View>
  );
}

function CourseBody({ course, onOpen }: { course: CourseDetail; onOpen: (id: string) => void }) {
  const p = usePalette();
  const total = course.modules.reduce((n, m) => n + m.chapters.length, 0);
  const done = course.modules.reduce((n, m) => n + m.chapters.filter((c) => c.done).length, 0);
  const up = nextUp(course);
  if (total === 0) return <Message title="This course has no chapters yet." body="It is still being written. Come back when it is ready." />;
  return (
    <View style={styles.gap}>
      <View style={styles.head}>
        <Text role="heading" aria-level={1} style={[styles.title, { color: p.text }]}>
          {course.title}
        </Text>
        <View style={styles.progress}>
          <View style={{ flex: 1 }}>
            <Bar value={(done / total) * 100} />
          </View>
          <Text style={[styles.count, { color: p.muted }]}>
            {done} of {total} read
          </Text>
        </View>
        {up ? (
          <Pressable role="link" onPress={() => onOpen(up)} style={({ pressed, hovered }) => [styles.primary, { backgroundColor: p.accent }, (pressed || hovered) && { opacity: 0.85 }]}>
            <Text style={[styles.primaryText, { color: p.onAccent }]}>{done === 0 ? 'Start reading' : 'Continue'}</Text>
            <Icon name="arrowRight" size={18} color={p.onAccent} stroke={2.2} />
          </Pressable>
        ) : null}
      </View>
      <Outline course={course} currentId={course.lastOpenedChapterId} onOpen={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: readingWidth, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 48 },
  gap: { gap: space.xl },
  head: { gap: 14, paddingHorizontal: space.xs },
  title: { fontFamily: font.reading, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  count: { fontFamily: font.mono, fontSize: 13 },
  primary: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  primaryText: { fontFamily: font.ui, fontSize: 16, fontWeight: '600' },
});
