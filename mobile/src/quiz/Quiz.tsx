/**
 * Check yourself: the chapter's questions one at a time. Choose an answer, see at once whether it
 * was right and why, then move on; after the last, the score. Answers already given show as
 * answered when you come back, and Try again lets you answer afresh.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Question } from '@/api/types';
import { useAnswer } from '../queries';
import { usePalette } from '../settings';
import { font, radius, space, touch } from '../theme';
import { Icon } from '../components/TopBar';
import { Runs } from '../markdown/blocks';
import { parseInline } from '../markdown/parse';

type Result = { chosen: number; correct: boolean };

function fromServer(questions: Question[]): Record<string, Result> {
  const out: Record<string, Result> = {};
  for (const q of questions) if (q.lastAttempt) out[q.id] = q.lastAttempt;
  return out;
}

export function Quiz({ chapterId, questions }: { chapterId: string; questions: Question[] }) {
  const p = usePalette();
  const save = useAnswer(chapterId);
  const [results, setResults] = useState<Record<string, Result>>(() => fromServer(questions));
  const [index, setIndex] = useState(() => {
    const open = questions.findIndex((q) => !q.lastAttempt);
    return open < 0 ? questions.length : open;
  });
  const [pending, setPending] = useState<number | null>(null);

  if (questions.length === 0) return null;
  // Questions are written in markdown too (`runAgent`, **only**); render it, never the raw marks.
  const md = (text: string, size: number) => <Runs inlines={parseInline(text)} look={{ size, lineHeight: 1.45, family: font.ui, palette: p }} />;

  const done = index >= questions.length;
  const q = questions[Math.min(index, questions.length - 1)];
  const result = results[q.id];
  const right = Object.values(results).filter((r) => r.correct).length;

  const choose = (chosen: number) => {
    if (result || save.isPending) return;
    setPending(chosen);
    save.mutate(
      { questionId: q.id, chosen },
      {
        onSuccess: (r) => {
          setResults((all) => ({ ...all, [q.id]: { chosen, correct: r.correct } }));
          setPending(null);
        },
      },
    );
  };

  return (
    <View style={[styles.box, { backgroundColor: p.surface, borderColor: p.border }]} role="region" aria-label="Check yourself">
      <View style={styles.head}>
        <Text role="heading" aria-level={2} style={[styles.kicker, { color: p.muted }]}>
          Check yourself
        </Text>
        <View style={styles.steps} role="img" aria-label={done ? `${questions.length} of ${questions.length} answered` : `Question ${index + 1} of ${questions.length}`}>
          {questions.map((x, i) => (
            <View key={x.id} style={[styles.step, { backgroundColor: results[x.id] || i < index ? p.accent : p.borderStrong }]} />
          ))}
        </View>
      </View>

      {done ? (
        <View style={styles.gap}>
          <Text style={[styles.score, { color: p.text }]}>
            You got {right} of {questions.length} right.
          </Text>
          <Text style={[styles.body, { color: p.muted }]}>{right === questions.length ? 'Ready for the next chapter.' : 'Reread the parts you missed, or try the questions again.'}</Text>
          <Pressable
            role="button"
            onPress={() => {
              setResults({});
              setIndex(0);
            }}
            style={({ hovered }) => [styles.secondary, { borderColor: p.borderStrong, backgroundColor: hovered ? p.raised : 'transparent' }]}
          >
            <Text style={[styles.secondaryText, { color: p.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gap}>
          <Text style={[styles.prompt, { color: p.text }]}>{md(q.prompt, 20)}</Text>
          <View role="radiogroup" aria-label="Answers" style={styles.options}>
            {q.options.map((o, i) => {
              const picked = result ? result.chosen === i : pending === i;
              const isAnswer = result && i === q.answer;
              const wrongPick = result && picked && !result.correct;
              const border = isAnswer ? p.accentInk : wrongPick ? p.danger : picked ? p.text : p.border;
              return (
                <Pressable
                  key={i}
                  role="radio"
                  aria-checked={picked}
                  disabled={Boolean(result) || save.isPending}
                  onPress={() => choose(i)}
                  style={({ hovered }) => [
                    styles.option,
                    { borderColor: border, borderWidth: isAnswer || wrongPick || picked ? 2 : 1, backgroundColor: hovered && !result ? p.raised : p.ground },
                  ]}
                >
                  <Text style={[styles.optionText, { color: result && !isAnswer && !picked ? p.muted : p.text }]}>{md(o, 15)}</Text>
                  {isAnswer ? (
                    <View style={[styles.mark, { backgroundColor: p.accent }]} aria-label="Correct answer" role="img">
                      <Icon name="check" size={15} color={p.onAccent} stroke={2.8} />
                    </View>
                  ) : wrongPick ? (
                    <View style={[styles.mark, { borderColor: p.danger, borderWidth: 2 }]} aria-label="Your answer, not right" role="img">
                      <Icon name="close" size={13} color={p.danger} stroke={2.6} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {save.isError && pending !== null ? (
            <View style={styles.row} role="alert">
              <Text style={[styles.body, { color: p.danger, flex: 1 }]}>Couldn't save your answer.</Text>
              <Pressable role="button" onPress={() => choose(pending)} style={styles.link}>
                <Text style={[styles.linkText, { color: p.accentInk }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {result ? (
            <View style={[styles.verdict, { backgroundColor: p.ground }]} aria-live="polite">
              <Text style={[styles.verdictTitle, { color: result.correct ? p.accentInk : p.danger }]}>{result.correct ? 'Right' : 'Not quite'}</Text>
              <Text style={[styles.body, { color: p.body }]}>{md(q.explanation, 14)}</Text>
            </View>
          ) : null}

          {result ? (
            <Pressable role="button" onPress={() => setIndex((i) => i + 1)} style={({ hovered }) => [styles.secondary, { borderColor: p.borderStrong, backgroundColor: hovered ? p.raised : 'transparent', alignSelf: 'flex-end' }]}>
              <Text style={[styles.secondaryText, { color: p.text }]}>{index + 1 < questions.length ? 'Next question' : 'See your score'}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: font.ui, fontSize: 13, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' },
  steps: { flexDirection: 'row', gap: 6 },
  step: { width: 22, height: 6, borderRadius: 3 },
  gap: { gap: space.md },
  prompt: { fontFamily: font.reading, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  options: { gap: 10 },
  option: { minHeight: 56, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  optionText: { flex: 1, fontFamily: font.ui, fontSize: 15, lineHeight: 21 },
  mark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  verdict: { borderRadius: radius.md, padding: space.lg, gap: 6 },
  verdictTitle: { fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
  body: { fontFamily: font.ui, fontSize: 14, lineHeight: 21 },
  score: { fontFamily: font.reading, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  secondary: { minHeight: touch, paddingHorizontal: space.lg, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignSelf: 'flex-start' },
  secondaryText: { fontFamily: font.ui, fontSize: 15, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: { minHeight: touch, justifyContent: 'center', paddingHorizontal: space.sm },
  linkText: { fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
});
