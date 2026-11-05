import { SceneFrame } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';
import c from './concepts-scene.module.css';

const FALLBACK = [
  'Core idea',
  'Basics',
  'Foundations',
  'Patterns',
  'Practice',
  'Tooling',
  'Advanced',
];

interface Edge {
  d: string;
  tone: string;
  delay?: string;
}

function Node({
  cx: x,
  cy: y,
  r,
  label,
  ring,
  delay,
  note,
  max,
}: {
  cx: number;
  cy: number;
  r: number;
  label: string;
  ring: string;
  delay?: string;
  note?: string;
  max: number;
}) {
  return (
    <g data-slot="scene-progress" className={cx(s.float, delay)}>
      <circle cx={x} cy={y} r={r} strokeWidth="3" className={cx(s.fSurface, ring)} />
      <text x={x} y={y + 4} fontSize="12" textAnchor="middle" className={s.fText}>
        {trunc(label, max)}
      </text>
      {note && (
        <text x={x} y={y + r + 18} fontSize="12" textAnchor="middle" className={s.fDim}>
          {note}
        </text>
      )}
    </g>
  );
}

/** Stage 2: the concept map forming around the course's central idea. */
export function ConceptsScene({ data, height }: SceneProps) {
  // Real concepts never mix with placeholder ones: missing slots are left out.
  const names = pick(data.concepts, FALLBACK).slice(0, 7);
  const [centre, a, b, d, e, f, g] = names;
  const count = data.concepts?.length ?? 0;

  const edges: Array<Edge | false> = [
    !!a && { d: 'M200 110 C 280 120, 330 160, 360 190', tone: s.sBlue },
    !!b && { d: 'M190 310 C 270 300, 320 260, 358 236', tone: s.sBlue, delay: s.d1 },
    !!d && { d: 'M442 190 C 480 160, 530 125, 590 112', tone: s.sAccent, delay: s.d2 },
    !!e && { d: 'M444 232 C 490 262, 540 296, 600 306', tone: s.sAccent, delay: s.d3 },
    !!d && !!e && { d: 'M620 148 C 630 190, 630 240, 622 268', tone: s.sAmber, delay: s.d1 },
    !!f && { d: 'M400 268 L400 322', tone: s.sAccent, delay: s.d2 },
  ];

  return (
    <SceneFrame
      height={height}
      label={`A concept map forming, with ${centre} at the centre${names.length > 1 ? ` linked to ${names.slice(1, 6).join(', ')}` : ''}`}
    >
      <g fill="none" strokeWidth="2.5" strokeLinecap="round">
        {edges
          .filter((edge): edge is Edge => !!edge)
          .map(edge => (
            <g key={edge.d}>
              <path d={edge.d} className={s.sFaint} />
              <path d={edge.d} data-slot="scene-progress" className={cx(c.draw, edge.delay, edge.tone)} />
            </g>
          ))}
        {e && g && (
          <path
            d="M660 306 C 704 300, 722 262, 730 232"
            strokeDasharray="4 8"
            className={s.sFaint}
          />
        )}
      </g>
      <circle cx="400" cy="212" r="84" data-slot="scene-progress" className={cx(s.fAccent, s.pulse)} opacity="0.1" />
      <circle cx="400" cy="212" r="56" className={s.fAccent} />
      <text
        x="400"
        y="217"
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        className={s.fOnAccent}
      >
        {trunc(centre, 12)}
      </text>
      {a && <Node cx={186} cy={104} r={40} label={a} ring={s.sBlue} note="prerequisite" max={9} />}
      {b && <Node cx={176} cy={314} r={40} label={b} ring={s.sBlue} delay={s.d2} max={9} />}
      {d && <Node cx={618} cy={108} r={42} label={d} ring={s.sAccent} delay={s.d1} max={9} />}
      {e && <Node cx={622} cy={306} r={42} label={e} ring={s.sAmber} delay={s.d3} max={9} />}
      {f && (
        <g>
          <circle cx="400" cy="360" r="36" strokeWidth="3" className={cx(s.fSurface, s.sAccent)} />
          <text x="400" y="364" fontSize="12" textAnchor="middle" className={s.fText}>
            {trunc(f, 9)}
          </text>
        </g>
      )}
      {g && (
        <g data-slot="scene-progress" className={cx(s.pulse, s.d2)}>
          <circle
            cx="738"
            cy="206"
            r="28"
            strokeWidth="2"
            strokeDasharray="4 5"
            className={cx(s.fNone, s.sLine)}
          />
          <text x="738" y="210" fontSize="11" textAnchor="middle" className={s.fDim}>
            {trunc(g, 7)}
          </text>
        </g>
      )}
      <text x="40" y="44" fontSize="13" className={cx(s.mono, s.fDim)}>
        {count
          ? `${count} concepts · linking prerequisites`
          : 'finding concepts · linking prerequisites'}
      </text>
    </SceneFrame>
  );
}
