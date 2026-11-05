import type { CSSProperties } from 'react';

import { SceneFrame } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';
import o from './outline-scene.module.css';

const FALLBACK = ['Foundations', 'Core concepts', 'Putting it together', 'Going further'];

/** Bottom to top: sky, amber, coral, then the lime slab that is landing. */
const TONES = [
  { slab: 'var(--sc-blue)', ink: 'var(--sc-blue-ink)' },
  { slab: 'var(--sc-amber)', ink: 'var(--sc-amber-ink)' },
  { slab: 'var(--sc-red)', ink: 'var(--sc-red-ink)' },
  { slab: 'var(--sc-accent)', ink: 'var(--sc-accent-ink)' },
];

function Slab({ c }: { c: number }) {
  return (
    <>
      <polygon points={`250,${c} 400,${c + 75} 400,${c + 101} 250,${c + 26}`} className={o.left} />
      <polygon points={`400,${c + 75} 550,${c} 550,${c + 26} 400,${c + 101}`} className={o.right} />
      <polygon points={`400,${c - 75} 550,${c} 400,${c + 75} 250,${c}`} className={o.top} />
      <polygon
        points={`400,${c - 49} 498,${c} 400,${c + 49} 302,${c}`}
        strokeWidth="2"
        className={o.inset}
      />
    </>
  );
}

/** Stage 3: module slabs stacking into a tower, the newest one dropping in. */
export function OutlineScene({ data, height }: SceneProps) {
  const all = pick(data.modules, FALLBACK);
  const shown = all.slice(0, 4);
  const count = data.modules?.length ?? 0;

  return (
    <SceneFrame height={height} label={`Module slabs stacking into a tower: ${shown.join(', ')}`}>
      <ellipse cx="340" cy="402" rx="190" ry="14" className={s.fShadow} />
      <g transform="translate(-60 0)">
        {shown.map((_, i) => {
          const c = 311 - i * 40;
          const style = { '--slab': TONES[i].slab } as CSSProperties;
          const last = i === shown.length - 1;
          return (
            <g key={i} style={style} data-slot={last ? 'scene-progress' : undefined} className={last ? o.drop : undefined}>
              <Slab c={c} />
            </g>
          );
        })}
      </g>
      <g fontSize="14">
        {shown.map((name, i) => {
          const y = 324 - i * 40;
          const style = { '--slab': TONES[i].slab, '--slab-ink': TONES[i].ink } as CSSProperties;
          const last = i === shown.length - 1;
          return (
            <g key={i} style={style} data-slot={last ? 'scene-progress' : undefined} className={last ? s.pulse : undefined}>
              <line x1="496" y1={y} x2="560" y2={y} strokeWidth="2" className={s.sLine} />
              <circle cx="496" cy={y} r="4" className={o.top} />
              <text x="572" y={y + 5} className={s.fSoft}>
                <tspan fontWeight="700" className={o.tag}>{`M${i + 1}`}</tspan>
                {`  ${trunc(name, 24)}`}
              </text>
            </g>
          );
        })}
      </g>
      <text x="40" y="44" fontSize="13" className={cx(s.mono, s.fDim)}>
        {count
          ? `${count} module${count === 1 ? '' : 's'} · ordered by prerequisite${count > 4 ? ` · showing 4` : ''}`
          : 'outlining modules · ordered by prerequisite'}
      </text>
    </SceneFrame>
  );
}
