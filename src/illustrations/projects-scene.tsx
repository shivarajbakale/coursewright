import { Caption, Check, Rule, SceneFrame, Sheet } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';

const FALLBACK = ['Starter project', 'Guided build', 'Capstone'];

const X = 200;
const W = 400;
const HEAD = 56;
const ROW = 64;

/** Stage 5: the projects as a checklist on a card, the current brief being written. */
export function ProjectsScene({ data, height }: SceneProps) {
  const rows = pick(data.projects, FALLBACK).slice(0, 3);
  const count = data.projects?.length ?? 0;
  const cardH = HEAD + rows.length * ROW + 8;
  const top = Math.round((372 - cardH) / 2 / 4) * 4;

  return (
    <SceneFrame
      height={height}
      label={`Designing projects: a checklist of ${rows.join(', ')}, the last one being written`}
    >
      <Sheet x={X} y={top} w={W} h={cardH} />
      <text x={X + 24} y={top + 34} fontSize="14" className={s.dim}>
        Projects
      </text>
      <line
        x1={X + 24}
        y1={top + HEAD - 4}
        x2={X + W - 24}
        y2={top + HEAD - 4}
        className={s.line}
      />

      {rows.map((name, i) => {
        const y = top + HEAD + i * ROW;
        const now = i === rows.length - 1;
        return (
          <g key={i}>
            <rect
              x={X + 24}
              y={y + 12}
              width="16"
              height="16"
              rx="4"
              className={now ? s.inkNow : s.line}
            />
            {!now && <Check x={X + 24} y={y + 12} />}
            <text x={X + 56} y={y + 25} fontSize="14" className={now ? s.text : s.dim}>
              {trunc(name, 40)}
            </text>
            {now ? (
              <Rule x={X + 56} y={y + 44} w={224} className={cx(s.fillNow, s.write)} progress />
            ) : (
              <Rule x={X + 56} y={y + 44} w={i % 2 ? 184 : 248} />
            )}
          </g>
        );
      })}

      <Caption
        label="Writing briefs and tests"
        figure={count ? `${count} project${count === 1 ? '' : 's'}` : undefined}
      />
    </SceneFrame>
  );
}
