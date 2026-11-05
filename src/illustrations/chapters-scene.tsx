import { SceneFrame } from './scene-kit';
import { cx, paint as s, textWidth, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';
import ch from './chapters-scene.module.css';

const FALLBACK = ['Getting started', 'First principles', 'A worked example', 'Common mistakes'];

function Tag({
  label,
  x,
  y,
  anchor,
  done,
  className,
}: {
  label: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  done: boolean;
  className?: string;
}) {
  const w = textWidth(label, 13) + 32;
  const left = anchor === 'start' ? x : x - w;
  return (
    <g className={className}>
      <rect
        x={left}
        y={y}
        width={w}
        height="40"
        rx="12"
        className={cx(s.fSurface, done ? s.sAccentEdge : s.sLine)}
      />
      <text x={left + 16} y={y + 25} fontSize="13" className={done ? s.fAccentInk : s.fSoft}>
        {label}
      </text>
    </g>
  );
}

/** Stage 4: an open book being written, finished chapters flying off it. */
export function ChaptersScene({ data, height }: SceneProps) {
  const live = (data.chapters ?? []).map(t => t.trim()).filter(Boolean);
  const titles = live.length ? live : FALLBACK;
  const total = Math.max(data.chapterTotal ?? titles.length, titles.length);
  const done = Math.min(live.length ? (data.chapterDone ?? 0) : 2, total);

  const latest = done > 0 ? titles[done - 1] : undefined;
  const before = done > 1 ? titles[done - 2] : undefined;
  const writing = done < total ? (titles[done] ?? `Chapter ${done + 1}`) : undefined;

  const counter =
    done >= total
      ? `${total} of ${total} chapters written`
      : `${done} of ${total} chapters written`;
  const label = `An open book being written. ${counter}${writing ? `, now writing ${writing}` : ''}.`;

  return (
    <SceneFrame height={height} label={label}>
      <ellipse cx="400" cy="372" rx="250" ry="16" className={s.fShadow} />
      <path
        d="M400 140 C 330 112, 250 110, 160 122 L160 344 C 250 332, 330 334, 400 362 Z"
        strokeWidth="2"
        className={cx(s.fSurface, s.sLine)}
      />
      <g data-slot="scene-progress" className={ch.sheet}>
        <rect
          x="470"
          y="170"
          width="90"
          height="116"
          rx="6"
          strokeWidth="2"
          className={cx(s.fRaised, s.sLine)}
        />
      </g>
      <g data-slot="scene-progress" className={cx(ch.sheet, ch.sheetLate)}>
        <rect
          x="450"
          y="190"
          width="90"
          height="116"
          rx="6"
          strokeWidth="2"
          className={cx(s.fRaised, s.sLine)}
        />
      </g>
      <path
        d="M400 140 C 470 112, 550 110, 640 122 L640 344 C 550 332, 470 334, 400 362 Z"
        strokeWidth="2"
        className={cx(s.fRaised, s.sLine)}
      />
      <line x1="400" y1="140" x2="400" y2="362" strokeWidth="2" className={s.sLine} />
      <rect x="188" y="148" width="90" height="10" rx="5" className={s.fBlue} />
      <rect x="188" y="172" width="170" height="7" rx="3.5" className={s.fLine} />
      <rect x="188" y="188" width="150" height="7" rx="3.5" className={s.fLine} />
      <rect
        x="196"
        y="212"
        width="66"
        height="44"
        rx="8"
        strokeWidth="2"
        className={cx(s.fNone, s.sBlue)}
      />
      <path d="M266 234 L300 234" strokeWidth="2.5" className={s.sAccent} />
      <path
        d="M294 228 L302 234 L294 240"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cx(s.fNone, s.sAccent)}
      />
      <rect
        x="306"
        y="212"
        width="66"
        height="44"
        rx="8"
        strokeWidth="2"
        className={cx(s.fNone, s.sAccent)}
      />
      <rect x="188" y="276" width="160" height="7" rx="3.5" className={s.fLine} />
      <rect x="188" y="292" width="130" height="7" rx="3.5" className={s.fLine} />
      <rect x="428" y="148" width="120" height="10" rx="5" data-slot="scene-progress" className={cx(ch.grow, s.fAccent)} />
      <rect
        x="428"
        y="176"
        width="180"
        height="7"
        rx="3.5"
        data-slot="scene-progress" className={cx(ch.grow, s.d1, s.fLine)}
      />
      <rect
        x="428"
        y="194"
        width="160"
        height="7"
        rx="3.5"
        data-slot="scene-progress" className={cx(ch.grow, s.d2, s.fLine)}
      />
      <rect
        x="428"
        y="212"
        width="176"
        height="7"
        rx="3.5"
        data-slot="scene-progress" className={cx(ch.grow, s.d3, s.fLine)}
      />
      <rect x="428" y="238" width="176" height="48" rx="8" data-slot="scene-progress" className={cx(ch.grow, s.d4, s.fDeep)} />
      <g data-slot="scene-progress" className={s.float}>
        <g transform="rotate(38 600 200)">
          <rect x="592" y="120" width="18" height="110" rx="9" className={s.fSoft} />
          <rect x="592" y="120" width="18" height="24" rx="9" className={s.fAmber} />
          <path d="M592 226 L610 226 L601 252 Z" className={s.fAccent} />
        </g>
      </g>
      {latest && (
        <g data-slot="scene-progress" className={ch.fly}>
          <Tag
            label={`✓ ${trunc(latest, 20)}`}
            x={60}
            y={54}
            anchor="start"
            done
            data-slot="scene-progress" className={cx(s.float, s.d1)}
          />
        </g>
      )}
      {before && (
        <Tag
          label={`✓ ${trunc(before, 20)}`}
          x={760}
          y={40}
          anchor="end"
          done
          data-slot="scene-progress" className={cx(s.float, s.d3)}
        />
      )}
      {writing && (
        <Tag
          label={trunc(writing, 18).replace(/…?$/, '…')}
          x={772}
          y={300}
          anchor="end"
          done={false}
          data-slot="scene-progress" className={cx(s.float, s.d2)}
        />
      )}
      <text x="40" y="404" fontSize="13" className={cx(s.mono, s.fDim)}>
        {counter}
      </text>
    </SceneFrame>
  );
}
