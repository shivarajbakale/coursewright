import { Caption, Check, Rule, SceneFrame, Sheet } from './scene-kit';
import { cx, paint as s, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';

const FALLBACK = ['Getting started', 'First principles', 'A worked example', 'Common mistakes'];

/** The written lines on the page in progress; the next one is being written. */
const WRITTEN = [208, 192, 200, 168];

/** Stage 4: finished pages stacked on the left, the next chapter being written on the right. */
export function ChaptersScene({ data, height }: SceneProps) {
  const live = (data.chapters ?? []).map(t => t.trim()).filter(Boolean);
  const titles = live.length ? live : FALLBACK;
  const total = Math.max(data.chapterTotal ?? titles.length, titles.length);
  const done = Math.min(live.length ? (data.chapterDone ?? 0) : 2, total);

  const latest = done > 0 ? titles[done - 1] : undefined;
  const writing = done < total ? (titles[done] ?? `Chapter ${done + 1}`) : undefined;

  const label = `Pages being written: ${done} of ${total} chapters written${writing ? `, now writing ${writing}` : ''}`;

  return (
    <SceneFrame height={height} label={label}>
      {/* Written pages. */}
      {done > 2 && <Sheet x={136} y={64} w={232} h={264} tone="back" />}
      {done > 1 && <Sheet x={128} y={72} w={232} h={264} tone="back" />}
      <Sheet x={120} y={80} w={232} h={264} tone={done > 0 ? 'front' : 'back'} />
      {latest ? (
        <>
          <Check x={144} y={102} />
          <text x="168" y="116" fontSize="14" className={s.text}>
            {trunc(latest, 22)}
          </text>
          <line x1="144" y1="136" x2="328" y2="136" className={s.line} />
          {[184, 168, 176, 152, 184, 136].map((w, i) => (
            <Rule key={i} x={144} y={160 + i * 24} w={w} />
          ))}
        </>
      ) : (
        <text x="144" y="116" fontSize="14" className={s.dim}>
          No pages yet
        </text>
      )}

      {/* The page in progress. */}
      <Sheet x={432} y={64} w={256} h={280} />
      {writing ? (
        <>
          <text x="456" y="100" fontSize="14" fontWeight="500" className={s.text}>
            {trunc(writing, 26)}
          </text>
          <line x1="456" y1="120" x2="664" y2="120" className={s.line} />
          {WRITTEN.map((w, i) => (
            <Rule key={i} x={456} y={144 + i * 24} w={w} />
          ))}
          <Rule
            x={456}
            y={144 + WRITTEN.length * 24}
            w={152}
            className={cx(s.fillNow, s.write)}
            progress
          />
        </>
      ) : (
        <text x="456" y="100" fontSize="14" className={s.dim}>
          Every chapter is written
        </text>
      )}

      <Caption label="Writing chapters" figure={`${done} / ${total}`} />
    </SceneFrame>
  );
}
