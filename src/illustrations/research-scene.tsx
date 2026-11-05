import { SceneFrame, Sparkle } from './scene-kit';
import { cx, paint as s, pick, textWidth, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';
import r from './research-scene.module.css';

const FALLBACK = ['key ideas', 'core terms', 'examples', 'pitfalls', 'prerequisites'];

function Chip({
  label,
  x,
  y,
  anchor,
  accent,
  delay,
}: {
  label: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  accent?: boolean;
  delay?: string;
}) {
  const w = textWidth(label, 14) + 40;
  const left = anchor === 'start' ? x : x - w;
  return (
    <g data-slot="scene-progress" className={cx(s.float, delay)}>
      <rect
        x={left}
        y={y}
        width={w}
        height="36"
        rx="18"
        className={cx(s.fSurface, accent ? s.sAccentEdge : s.sLine)}
      />
      <text x={left + 20} y={y + 23} fontSize="14" className={accent ? s.fAccentInk : s.fSoft}>
        {label}
      </text>
    </g>
  );
}

const SPOTS = [
  { x: 60, y: 62, anchor: 'start' as const },
  { x: 740, y: 58, anchor: 'end' as const, accent: true, delay: s.d1 },
  { x: 760, y: 320, anchor: 'end' as const, delay: s.d2 },
  { x: 40, y: 330, anchor: 'start' as const, delay: s.d3 },
];

/** Stage 1: a magnifier scanning source documents while topic words float out. */
export function ResearchScene({ data, height }: SceneProps) {
  const words = pick(data.terms, FALLBACK);
  const lens = trunc(words[0] ?? 'topic', 10);
  // Placeholder words only pad an empty scene; real terms never mix with them.
  const pool = data.terms?.length ? words.slice(1) : FALLBACK.slice(1);
  const chips = pool.slice(0, 4).map(w => trunc(w, 18));
  const lensSize = Math.min(22, Math.floor(100 / (lens.length * 0.62)));
  const found = data.terms?.length ? `${data.terms.length} terms found` : 'scanning sources';
  const topic = data.topic?.trim() || 'your topic';

  return (
    <SceneFrame
      height={height}
      label={`Researching ${trunc(topic, 60)}: a magnifier scanning source documents while topic words such as ${[lens, ...chips].join(', ')} float out of them`}
    >
      <circle cx="400" cy="220" r="170" className={s.fAccent} opacity="0.06" />
      <g transform="rotate(-10 240 240)">
        <rect
          x="150"
          y="130"
          width="180"
          height="230"
          rx="16"
          strokeWidth="2"
          className={cx(s.fSurface, s.sLine)}
        />
        <rect x="172" y="156" width="80" height="10" rx="5" className={s.fBlue} />
        <rect x="172" y="186" width="130" height="7" rx="3.5" className={s.fLine} />
        <rect x="172" y="204" width="110" height="7" rx="3.5" className={s.fLine} />
        <rect x="172" y="222" width="124" height="7" rx="3.5" className={s.fLine} />
        <rect x="172" y="260" width="136" height="60" rx="8" className={s.fRaised} />
      </g>
      <g transform="rotate(9 540 240)">
        <rect
          x="450"
          y="130"
          width="180"
          height="230"
          rx="16"
          strokeWidth="2"
          className={cx(s.fSurface, s.sLine)}
        />
        <rect x="472" y="156" width="70" height="10" rx="5" className={s.fAmber} />
        <rect x="472" y="186" width="130" height="7" rx="3.5" className={s.fLine} />
        <rect x="472" y="204" width="100" height="7" rx="3.5" className={s.fLine} />
        <rect x="472" y="222" width="120" height="7" rx="3.5" className={s.fLine} />
        <rect x="472" y="240" width="90" height="7" rx="3.5" className={s.fLine} />
      </g>
      <g>
        <rect
          x="300"
          y="92"
          width="200"
          height="262"
          rx="18"
          strokeWidth="2"
          className={cx(s.fRaised, s.sLine)}
        />
        <rect x="324" y="120" width="96" height="12" rx="6" className={s.fAccent} />
        <rect x="324" y="152" width="150" height="8" rx="4" className={s.fLine} />
        <rect x="324" y="172" width="128" height="8" rx="4" className={s.fLine} />
        <rect x="320" y="188" width="160" height="22" rx="6" className={s.fAccent} opacity="0.22" />
        <rect x="324" y="195" width="140" height="8" rx="4" className={s.fAccent} opacity="0.8" />
        <rect x="324" y="222" width="146" height="8" rx="4" className={s.fLine} />
        <rect x="324" y="242" width="110" height="8" rx="4" className={s.fLine} />
        <rect x="324" y="274" width="152" height="54" rx="8" className={s.fSurface} />
        <text
          x="336"
          y="306"
          fontSize="13"
          className={cx(s.mono, s.fSoft)}
        >{`? ${trunc(topic, 14)}`}</text>
      </g>
      <g data-slot="scene-progress" className={r.scan}>
        <circle cx="470" cy="196" r="60" strokeWidth="10" className={cx(s.fLens, s.sAccent)} />
        <text
          x="470"
          y="190"
          fontSize={lensSize}
          fontWeight="700"
          textAnchor="middle"
          className={s.fText}
        >
          {lens}
        </text>
        <text x="470" y="214" fontSize="12" textAnchor="middle" className={s.fDim}>
          {found}
        </text>
        <line
          x1="514"
          y1="240"
          x2="572"
          y2="298"
          strokeWidth="16"
          strokeLinecap="round"
          className={s.sAccent}
        />
      </g>
      {SPOTS.slice(0, chips.length).map((spot, i) => (
        <Chip key={spot.x} label={chips[i]} {...spot} />
      ))}
      <Sparkle x={250} y={70} className={cx(s.fAccent, s.pulse)} />
      <Sparkle x={588} y={140} scale={0.7} className={cx(s.fBlue, s.pulse, s.d1)} />
      <Sparkle x={120} y={250} scale={0.6} className={cx(s.fAmber, s.pulse, s.d2)} />
    </SceneFrame>
  );
}
