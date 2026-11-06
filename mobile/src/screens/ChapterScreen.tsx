/**
 * One chapter, read as a book: large text at a comfortable measure, a thin progress bar, and the
 * next chapter one tap away at the end. Reopening a chapter lands where you stopped.
 *
 * Progress: opening a chapter never started marks it started; reaching the end marks it read.
 * The server overwrites `finishedAt` on every call, so each is sent at most once.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollEvent, ScrollViewHandle } from 'react-native';
import type { Chapter } from '@/api/types';
import { chapterNumber, useChapter, useChapterProgress, useCourse } from '../queries';
import { href, navigate } from '../router';
import { lineHeights, usePalette, useSettings } from '../settings';
import { getMark, setMark } from '../scrollMarks';
import { font, radius, readingWidth, space } from '../theme';
import { Blocks, type Look } from '../markdown/blocks';
import { parseChapter } from '../markdown/parse';
import { Outline } from '../components/Outline';
import { shortTitle, type Layout } from '../courseMath';
import { Message, Skeleton } from '../components/States';
import { Icon, IconButton, SettingsButton, TopBar } from '../components/TopBar';
import { Diagrams } from '../diagrams/Diagrams';
import { Quiz } from '../quiz/Quiz';
import { Bar } from './LibraryScreen';

/** Within this many pixels of the bottom counts as having read to the end. */
const END_SLACK = 160;

export function ChapterScreen({ courseId, chapterId, layout }: { courseId: string; chapterId: string; layout: Layout }) {
  const p = usePalette();
  const chapter = useChapter(chapterId);
  const course = useCourse(courseId);
  const where = chapterNumber(course.data, chapterId);
  const [drawer, setDrawer] = useState(false);

  const openOutline = () => (layout === 'narrow' ? navigate(href({ name: 'course', courseId })) : setDrawer(true));

  return (
    <View style={{ flex: 1, backgroundColor: p.ground }}>
      <TopBar
        left={
          layout === 'split' ? null : (
            <IconButton label="Course outline" onPress={openOutline}>
              <Icon name="outline" color={p.text} stroke={1.8} />
            </IconButton>
          )
        }
        center={where ? <Text style={[styles.where, { color: p.muted }]}>{`${where.n} / ${where.total}`}</Text> : null}
        right={<SettingsButton onPress={() => navigate(href({ name: 'settings' }))} />}
      />
      {chapter.isPending ? (
        <View style={[styles.column, styles.loading]}>
          <Skeleton lines={2} height={30} />
          <Skeleton lines={6} height={18} />
        </View>
      ) : chapter.isError ? (
        <View style={[styles.column, styles.loading]}>
          <Message
            tone="error"
            title="Couldn't load this chapter."
            body="Check your connection, then try again."
            action="Try again"
            onAction={() => void chapter.refetch()}
          />
        </View>
      ) : (
        <Reading key={chapter.data.id} chapter={chapter.data} courseId={courseId} layout={layout} onOutline={openOutline} />
      )}

      {drawer && course.data ? (
        <View style={[StyleSheet.absoluteFill, styles.drawerWrap]}>
          <Pressable accessibilityLabel="Close the outline" onPress={() => setDrawer(false)} style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} />
          <View role="dialog" aria-label="Course outline" style={[styles.drawer, { backgroundColor: p.ground, borderRightColor: p.border }]}>
            <View style={styles.drawerHead}>
              <Text style={[styles.drawerTitle, { color: p.text }]} numberOfLines={2}>
                {course.data.title}
              </Text>
              <IconButton label="Close the outline" onPress={() => setDrawer(false)}>
                <Icon name="close" color={p.text} />
              </IconButton>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.drawerBody}>
              <Outline
                course={course.data}
                currentId={chapterId}
                onOpen={(id) => {
                  setDrawer(false);
                  navigate(href({ name: 'chapter', courseId, chapterId: id }));
                }}
              />
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Reading({ chapter, courseId, layout, onOutline }: { chapter: Chapter; courseId: string; layout: Layout; onOutline: () => void }) {
  const p = usePalette();
  const { size, typeface, spacing } = useSettings();
  const progress = useChapterProgress(chapter.id, courseId);
  const blocks = useMemo(() => parseChapter(chapter.markdown), [chapter.markdown]);
  const look: Look = { size, lineHeight: lineHeights[spacing], family: typeface === 'serif' ? font.reading : font.ui, palette: p };

  const scroller = useRef<ScrollViewHandle>(null);
  const viewport = useRef(0);
  const restored = useRef(false);
  const sent = useRef({ started: false, finished: false });
  const lastSave = useRef(0);
  const [read, setRead] = useState(() => getMark(chapter.id) * 100);

  // Opening a chapter never started marks it started (sent once; never for a chapter already read).
  useEffect(() => {
    if (!chapter.startedAt && !chapter.finishedAt && !sent.current.started) {
      sent.current.started = true;
      progress.mutate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per chapter; the screen remounts per chapter
  }, []);

  const finish = () => {
    if (chapter.finishedAt || sent.current.finished) return;
    sent.current.finished = true;
    progress.mutate(true);
  };

  const track = (y: number, content: number, view: number) => {
    viewport.current = view;
    const room = content - view;
    const ratio = room > 0 ? Math.min(1, Math.max(0, y / room)) : 1;
    setRead(ratio * 100);
    const now = Date.now();
    if (now - lastSave.current > 400 || ratio === 1) {
      lastSave.current = now;
      setMark(chapter.id, ratio >= 0.99 ? 0 : ratio);
    }
    if (room <= 0 || room - y < END_SLACK) finish();
  };

  const onScroll = (e: ScrollEvent) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    track(contentOffset.y, contentSize.height, layoutMeasurement.height);
  };

  // Land where you stopped once the text has its height; a short chapter is read on sight.
  const onContentSize = (_w: number, h: number) => {
    if (restored.current || h <= 0) return;
    restored.current = true;
    const mark = getMark(chapter.id);
    const view = viewport.current || window.innerHeight;
    if (h <= view) finish();
    else if (mark > 0) scroller.current?.scrollTo({ y: mark * (h - view), animated: false });
  };

  return (
    <>
      <Bar value={read} thin />
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={styles.column}
        scrollEventThrottle={64}
        onScroll={onScroll}
        onLayout={(e) => (viewport.current = e.nativeEvent.layout.height)}
        onContentSizeChange={onContentSize}
      >
        <View role="article" style={styles.article}>
          <View style={styles.header}>
            <Text style={[styles.module, { color: p.muted }]}>{chapter.moduleTitle}</Text>
            <Text role="heading" aria-level={1} style={[styles.title, { color: p.text, fontSize: Math.round(size * 1.65), lineHeight: Math.round(size * 1.65 * 1.2) }]}>
              {chapter.title}
            </Text>
            <Text style={[styles.module, { color: p.muted }]}>About {chapter.readingMinutes} min</Text>
          </View>
          {blocks.length ? (
            <Blocks blocks={blocks} look={look} />
          ) : (
            <Message title="This chapter is still being written." body="Pick another from the outline." action="Open outline" onAction={onOutline} />
          )}
        </View>
        {chapter.diagrams.length || chapter.questions.length ? (
          <View style={styles.extras}>
            <Diagrams diagrams={chapter.diagrams} startOpen={layout !== 'narrow'} />
            <Quiz chapterId={chapter.id} questions={chapter.questions} />
          </View>
        ) : null}
        <End chapter={chapter} courseId={courseId} />
      </ScrollView>
    </>
  );
}

function End({ chapter, courseId }: { chapter: Chapter; courseId: string }) {
  const p = usePalette();
  const go = (id: string) => navigate(href({ name: 'chapter', courseId, chapterId: id }));
  return (
    <View style={styles.end} role="navigation" aria-label="Chapters">
      {chapter.next ? (
        <Pressable role="link" onPress={() => go(chapter.next!.id)} style={({ pressed, hovered }) => [styles.next, { backgroundColor: p.accent }, (pressed || hovered) && { opacity: 0.88 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.nextLabel, { color: p.onAccent }]}>Next chapter</Text>
            <Text style={[styles.nextTitle, { color: p.onAccent }]}>{shortTitle(chapter.next.title)}</Text>
          </View>
          <Icon name="arrowRight" size={22} color={p.onAccent} stroke={2.2} />
        </Pressable>
      ) : (
        <Message title="You've reached the end of this course." body="Every chapter is in your outline whenever you want to go back." />
      )}
      {chapter.prev ? (
        <Pressable role="link" onPress={() => go(chapter.prev!.id)} style={({ hovered }) => [styles.prev, hovered && { backgroundColor: p.surface }]}>
          <Icon name="arrowLeft" size={16} color={p.muted} />
          <Text style={[styles.prevText, { color: p.muted }]} numberOfLines={1}>
            {shortTitle(chapter.prev.title)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  where: { fontFamily: font.mono, fontSize: 13 },
  column: { width: '100%', maxWidth: readingWidth, alignSelf: 'center', paddingHorizontal: 22, paddingTop: space.xl, paddingBottom: 64 },
  loading: { gap: space.xxl },
  article: { gap: 22 },
  header: { gap: space.sm, marginBottom: space.xs },
  module: { fontFamily: font.ui, fontSize: 13, lineHeight: 18 },
  title: { fontFamily: font.reading, fontWeight: '600', letterSpacing: -0.3 },
  extras: { marginTop: 40, gap: space.xl },
  end: { marginTop: 40, gap: space.md },
  next: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, minHeight: 72 },
  nextLabel: { fontFamily: font.ui, fontSize: 13, fontWeight: '500' },
  nextTitle: { fontFamily: font.reading, fontSize: 19, fontWeight: '600', lineHeight: 25 },
  prev: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.sm, alignSelf: 'flex-start', maxWidth: '100%' },
  prevText: { fontFamily: font.ui, fontSize: 14, flexShrink: 1 },
  drawerWrap: { zIndex: 10 },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 380, maxWidth: '86%', borderRightWidth: 1 },
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.xl, paddingRight: space.sm, paddingTop: space.md, paddingBottom: space.sm },
  drawerTitle: { flex: 1, fontFamily: font.reading, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  drawerBody: { paddingHorizontal: space.md, paddingBottom: space.xxl },
});
