import { Caption, SceneFrame } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';

const FALLBACK = [
  'Core idea',
  'Basics',
  'Foundations',
  'Patterns',
  'Practice',
  'Tooling',
  'Advanced',
];

const CENTRE = { x: 300, y: 180, w: 200, h: 48 };
const CARD_W = 152;
const CARD_H = 40;

/** Where each linked concept sits, in the order they are found. */
const SLOTS = [
  { x: 88, y: 72 },
  { x: 560, y: 72 },
  { x: 88, y: 300 },
  { x: 560, y: 300 },
  { x: 324, y: 60 },
  { x: 324, y: 312 },
];

/** A gentle curve from the centre card to a concept card's centre. */
function link(x: number, y: number): string {
  const sx = CENTRE.x + CENTRE.w / 2;
  const sy = CENTRE.y + CENTRE.h / 2;
  const tx = x + CARD_W / 2;
  const ty = y + CARD_H / 2;
  const mx = (sx + tx) / 2;
  return `M${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
}

/** Stage 2: concept cards linking to the course's central idea, the newest link being drawn. */
export function ConceptsScene({ data, height }: SceneProps) {
  // Real concepts never mix with placeholder ones: missing slots are left out.
  const names = pick(data.concepts, FALLBACK).slice(0, 7);
  const [centre, ...rest] = names;
  const placed = rest.map((name, i) => ({ name, ...SLOTS[i] }));
  const newest = placed.length - 1;
  const count = data.concepts?.length ?? 0;

  return (
    <SceneFrame
      height={height}
      label={`A concept map forming, with ${centre} at the centre${rest.length ? ` linked to ${rest.join(', ')}` : ''}`}
    >
      {placed.map((p, i) =>
        i === newest ? (
          <path
            key={p.name + i}
            d={link(p.x, p.y)}
            pathLength={1}
            data-slot="scene-progress"
            className={cx(s.inkNow, s.draw)}
          />
        ) : (
          <path key={p.name + i} d={link(p.x, p.y)} className={s.line} />
        )
      )}

      <rect
        x={CENTRE.x}
        y={CENTRE.y}
        width={CENTRE.w}
        height={CENTRE.h}
        rx="8"
        className={s.paper}
      />
      <text
        x={CENTRE.x + CENTRE.w / 2}
        y={CENTRE.y + 29}
        fontSize="16"
        fontWeight="500"
        textAnchor="middle"
        className={s.text}
      >
        {trunc(centre, 20)}
      </text>

      {placed.map((p, i) => (
        <g key={p.name + i}>
          <rect
            x={p.x}
            y={p.y}
            width={CARD_W}
            height={CARD_H}
            rx="8"
            className={i === newest ? s.paperNow : s.paper}
          />
          <text
            x={p.x + CARD_W / 2}
            y={p.y + 25}
            fontSize="14"
            textAnchor="middle"
            className={s.text}
          >
            {trunc(p.name, 17)}
          </text>
        </g>
      ))}

      <Caption
        label="Linking concepts by prerequisite"
        figure={count ? `${count} concept${count === 1 ? '' : 's'}` : undefined}
      />
    </SceneFrame>
  );
}
