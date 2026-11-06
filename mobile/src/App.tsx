/**
 * Phase 0 of the phone and iPad reader: the course library and one tutor box on a single screen.
 * Proves react-native-web, the shared API layer and a streamed tutor reply work together before
 * the reader screens are built (design: https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS).
 */
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useCourses } from './queries';
import { TutorProbe } from './TutorProbe';
import { color, font, radius, space } from './theme';

export function App() {
  const { width } = useWindowDimensions();
  const courses = useCourses();
  const first = courses.data?.[0]?.id ?? null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { maxWidth: width >= 700 ? 680 : undefined }]}>
      <Text style={styles.h1} role="heading">Your courses</Text>

      {courses.isPending && <ActivityIndicator color={color.accent} accessibilityLabel="Loading courses" />}
      {courses.isError && <Text style={styles.error}>Couldn’t reach your server. Is Tailscale on?</Text>}
      {courses.data?.length === 0 && <Text style={styles.muted}>No courses yet. Make one in the desktop app.</Text>}

      <View style={styles.list} role="list">
        {courses.data?.map((c) => (
          <View key={c.id} style={styles.row} role="listitem">
            <Text style={styles.courseTitle}>{c.title}</Text>
            <Text style={styles.muted}>
              {c.moduleCount} modules · {c.chapterCount} lessons · {c.chaptersDone} read
            </Text>
          </View>
        ))}
      </View>

      <TutorProbe courseId={first} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ground },
  content: { width: '100%', alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: 56, paddingBottom: 40, gap: space.xl },
  h1: { color: color.text, fontFamily: font.ui, fontSize: 30, fontWeight: '600', letterSpacing: -0.6 },
  list: { backgroundColor: color.surface, borderColor: color.border, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: { padding: space.lg, gap: space.xs, borderBottomColor: color.border, borderBottomWidth: 1 },
  courseTitle: { color: color.text, fontFamily: font.ui, fontSize: 16, fontWeight: '500', lineHeight: 21 },
  muted: { color: color.muted, fontFamily: font.ui, fontSize: 13 },
  error: { color: color.danger, fontFamily: font.ui, fontSize: 15 },
});
