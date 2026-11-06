/**
 * The phone and iPad reader (design: https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS).
 *
 * Layout follows the window, never the device, because iPad Split View and Slide Over change the
 * window: under 700 px one column; from 700 px the outline is a drawer; from 1024 px it sits beside
 * the chapter.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useCourse } from './queries';
import { href, navigate, useRoute } from './router';
import { usePalette } from './settings';
import { font, space } from './theme';
import { layoutFor } from './courseMath';
import { Outline } from './components/Outline';
import { Message } from './components/States';
import { ChapterScreen } from './screens/ChapterScreen';
import { CourseScreen } from './screens/CourseScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const route = useRoute();
  const { width } = useWindowDimensions();
  const p = usePalette();
  const layout = layoutFor(width);

  // The page behind the app, and the browser chrome, follow the reading theme.
  useEffect(() => {
    document.body.style.backgroundColor = p.ground;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.ground);
  }, [p.ground]);

  let screen;
  switch (route.name) {
    case 'library':
      screen = <LibraryScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'course':
      screen = <CourseScreen key={route.courseId} courseId={route.courseId} />;
      break;
    case 'chapter':
      screen =
        layout === 'split' ? (
          <View style={styles.split}>
            <Sidebar courseId={route.courseId} chapterId={route.chapterId} />
            <ChapterScreen key={route.chapterId} courseId={route.courseId} chapterId={route.chapterId} layout="split" />
          </View>
        ) : (
          <ChapterScreen key={route.chapterId} courseId={route.courseId} chapterId={route.chapterId} layout={layout} />
        );
      break;
    default:
      screen = (
        <View style={styles.missing}>
          <Message title="There's nothing at this address." body="It may be an old link." action="Go to your courses" onAction={() => navigate(href({ name: 'library' }), { replace: true })} />
        </View>
      );
  }

  return <View style={[styles.root, { backgroundColor: p.ground }]}>{screen}</View>;
}

function Sidebar({ courseId, chapterId }: { courseId: string; chapterId: string }) {
  const p = usePalette();
  const course = useCourse(courseId);
  return (
    <View role="navigation" aria-label="Course outline" style={[styles.sidebar, { borderRightColor: p.border }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sidebarBody}>
        <Text role="link" onPress={() => navigate(href({ name: 'library' }))} style={[styles.library, { color: p.muted }]}>
          ‹ Library
        </Text>
        {course.data ? (
          <>
            <Text style={[styles.courseTitle, { color: p.text }]}>{course.data.title}</Text>
            <Outline course={course.data} currentId={chapterId} onOpen={(id) => navigate(href({ name: 'chapter', courseId, chapterId: id }))} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100%' },
  split: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 300, borderRightWidth: 1 },
  sidebarBody: { padding: space.md, paddingTop: space.lg, gap: space.lg },
  library: { fontFamily: font.ui, fontSize: 14, paddingHorizontal: space.sm, paddingVertical: 10 },
  courseTitle: { fontFamily: font.reading, fontSize: 18, lineHeight: 24, fontWeight: '600', paddingHorizontal: space.sm },
  missing: { flex: 1, padding: space.lg, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
});
