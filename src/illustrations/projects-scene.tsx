import { SceneFrame, Sparkle } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';
import p from './projects-scene.module.css';

const FALLBACK = ['Starter project', 'Guided build', 'Capstone'];

function Gear({
  x,
  y,
  size,
  tone,
  spin,
}: {
  x: number;
  y: number;
  size: 'lg' | 'sm';
  tone: string;
  spin: string;
}) {
  const [tw, th, r0, r1, hub, hole, rx] =
    size === 'lg' ? [20, 24, 64, 40, 46, 18, 4] : [14, 16, 42, 26, 30, 11, 3];
  const teeth = (
    <>
      <rect x={-tw / 2} y={-r0} width={tw} height={th} rx={rx} />
      <rect x={-tw / 2} y={r1} width={tw} height={th} rx={rx} />
      <rect x={-r0} y={-tw / 2} width={th} height={tw} rx={rx} />
      <rect x={r1} y={-tw / 2} width={th} height={tw} rx={rx} />
    </>
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <g data-slot="scene-progress" className={cx(spin, tone)}>
        {teeth}
        <g transform="rotate(45)">{teeth}</g>
        <circle r={hub} />
        <circle r={hole} className={s.fSurface} />
      </g>
    </g>
  );
}

function slug(name: string): string {
  return trunc(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'project',
    21
  ).replace('…', '');
}

/** Stage 5: a terminal running a project's tests, gears, and the brief checklist. */
export function ProjectsScene({ data, height }: SceneProps) {
  const names = pick(data.projects, FALLBACK);
  const rows = names.slice(0, 3);
  const current = rows[rows.length - 1];
  const dir = slug(current);
  const count = data.projects?.length ?? 0;

  return (
    <SceneFrame
      grid="lines"
      height={height}
      label={`Designing projects: a terminal running tests beside turning gears and a checklist of ${rows.join(', ')}`}
    >
      <g data-slot="scene-progress" className={s.float}>
        <rect
          x="110"
          y="96"
          width="380"
          height="236"
          rx="18"
          strokeWidth="2"
          className={cx(s.fDeep, s.sLine)}
        />
        <circle cx="136" cy="120" r="6" className={s.fRed} />
        <circle cx="156" cy="120" r="6" className={s.fAmber} />
        <circle cx="176" cy="120" r="6" className={s.fAccent} />
        <line x1="110" y1="140" x2="490" y2="140" strokeWidth="2" className={s.sRaised} />
        <g fontSize="14" className={s.mono}>
          <text x="134" y="174" className={s.fAccentInk}>{`$ new ${dir}`}</text>
          <text x="134" y="200" className={s.fDim}>{`   created ${dir}/`}</text>
          <text x="134" y="232" className={s.fAccentInk}>
            $ run tests
          </text>
          <text x="134" y="258" className={s.fDim}>
            {' '}
            running milestone checks
          </text>
          <text x="134" y="284" className={s.fAccentInk}>
            {' '}
            result: ok · all passed
          </text>
        </g>
        <rect x="134" y="298" width="10" height="18" data-slot="scene-progress" className={cx(p.cursor, s.fText)} />
      </g>
      <Gear x={610} y={150} size="lg" tone={s.fAmber} spin={p.spin} />
      <Gear x={694} y={226} size="sm" tone={s.fBlue} spin={p.spinBack} />
      <g data-slot="scene-progress" className={cx(s.float, s.d2)}>
        <rect
          x="520"
          y="288"
          width="252"
          height={30 + rows.length * 26}
          rx="16"
          strokeWidth="2"
          className={cx(s.fSurface, s.sLine)}
        />
        <g fontSize="13">
          {rows.map((name, i) => {
            const y = 318 + i * 26;
            const pending = i === rows.length - 1;
            return (
              <g key={i}>
                <text x="542" y={y} data-slot={pending ? 'scene-progress' : undefined} className={pending ? cx(s.fAmberInk, s.pulse) : s.fAccentInk}>
                  {pending ? '●' : '✓'}
                </text>
                <text
                  x="564"
                  y={y}
                  className={pending ? s.fSoft : s.fText}
                >{`P${i + 1} ${trunc(name, 23)}`}</text>
              </g>
            );
          })}
        </g>
      </g>
      <Sparkle x={84} y={70} className={cx(s.fAccent, s.pulse, s.d1)} />
      <text x="40" y="404" fontSize="13" className={cx(s.mono, s.fDim)}>
        {count
          ? `${count} project${count === 1 ? '' : 's'} · writing briefs and tests`
          : 'designing projects'}
      </text>
    </SceneFrame>
  );
}
