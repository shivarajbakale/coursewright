import { SceneFrame } from './scene-kit';
import { cx, paint as s, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';
import x from './index-scene.module.css';

const GRID = [370, 390, 410, 430].flatMap((cx_, col) =>
  [190, 210, 230].map((cy, row) => ({
    cx: cx_,
    cy,
    delay: [undefined, s.d1, s.d2][(col + row) % 3],
  }))
);

const POINTS = [
  { cx: 600, cy: 160, tone: s.fAccent, delay: undefined },
  { cx: 660, cy: 170, tone: s.fBlue, delay: s.d1 },
  { cx: 700, cy: 150, tone: s.fAccent, delay: s.d2 },
  { cx: 620, cy: 216, tone: s.fAmber, delay: undefined },
  { cx: 690, cy: 224, tone: s.fAccent, delay: s.d2 },
  { cx: 640, cy: 276, tone: s.fBlue, delay: s.d1 },
  { cx: 710, cy: 270, tone: s.fAccent, delay: undefined },
];

const CHUNKS = [
  { y: 192, tone: s.fAccent, delay: undefined },
  { y: 214, tone: s.fBlue, delay: x.f1 },
  { y: 196, tone: s.fAccent, delay: x.f2 },
  { y: 212, tone: s.fAmber, delay: x.f3 },
  { y: 200, tone: s.fBlue, delay: x.f4 },
];

/** Stage 6: chapters split into chunks streaming through embedding into a vector store. */
export function IndexScene({ data, height }: SceneProps) {
  const chapters = data.chapterTotal ?? data.chapters?.length ?? 0;
  const chunks = data.chunks ?? 0;
  const status =
    chunks > 0 ? `${chunks.toLocaleString('en-US')} chunks · building index` : 'chunking chapters';
  const heading = trunc(data.chapters?.[0] ?? data.topic ?? '', 14);

  return (
    <SceneFrame
      height={height}
      label={`Chapters split into chunks that stream through an embedding step into a vector store. ${status}.`}
    >
      <rect
        x="70"
        y="128"
        width="130"
        height="170"
        rx="14"
        strokeWidth="2"
        className={cx(s.fSurface, s.sLine)}
      />
      <rect
        x="90"
        y="108"
        width="130"
        height="170"
        rx="14"
        strokeWidth="2"
        className={cx(s.fRaised, s.sLine)}
      />
      {heading ? (
        <text x="108" y="139" fontSize="11" fontWeight="600" className={s.fAccentInk}>
          {heading}
        </text>
      ) : (
        <rect x="108" y="130" width="60" height="9" rx="4.5" className={s.fAccent} />
      )}
      <rect x="108" y="152" width="94" height="6" rx="3" className={s.fLine} />
      <rect x="108" y="166" width="80" height="6" rx="3" className={s.fLine} />
      <rect
        x="104"
        y="184"
        width="104"
        height="26"
        rx="6"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        className={cx(s.fNone, s.sAccent)}
      />
      <rect
        x="104"
        y="218"
        width="104"
        height="26"
        rx="6"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        className={cx(s.fNone, s.sBlue)}
      />
      <text x="145" y="318" fontSize="12" textAnchor="middle" className={s.fDim}>
        {chapters ? `${chapters} chapter${chapters === 1 ? '' : 's'}` : 'chapters'}
      </text>
      <line
        x1="240"
        y1="210"
        x2="540"
        y2="210"
        strokeWidth="2"
        strokeDasharray="2 8"
        className={s.sRaised}
      />
      <g>
        {CHUNKS.map((c, i) => (
          <rect
            key={i}
            x="236"
            y={c.y}
            width="20"
            height="20"
            rx="5"
            data-slot="scene-progress" className={cx(x.flow, c.delay, c.tone)}
          />
        ))}
      </g>
      <rect
        x="336"
        y="150"
        width="128"
        height="120"
        rx="20"
        strokeWidth="2"
        className={cx(s.fDeep, s.sAccent)}
      />
      <g>
        {GRID.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r="4" data-slot="scene-progress" className={cx(s.fAccent, s.pulse, d.delay)} />
        ))}
      </g>
      <text x="400" y="296" fontSize="12" textAnchor="middle" className={cx(s.mono, s.fDim)}>
        embed
      </text>
      <path
        d="M560 128 L560 300 A 90 24 0 0 0 740 300 L740 128"
        strokeWidth="2"
        className={cx(s.fSurface, s.sLine)}
      />
      <ellipse
        cx="650"
        cy="128"
        rx="90"
        ry="24"
        strokeWidth="2"
        className={cx(s.fRaised, s.sLine)}
      />
      <path d="M560 186 A 90 24 0 0 0 740 186" strokeWidth="2" className={cx(s.fNone, s.sFaint)} />
      <path d="M560 244 A 90 24 0 0 0 740 244" strokeWidth="2" className={cx(s.fNone, s.sFaint)} />
      <g>
        {POINTS.map((pt, i) => (
          <circle key={i} cx={pt.cx} cy={pt.cy} r="4" data-slot="scene-progress" className={cx(pt.tone, s.pulse, pt.delay)} />
        ))}
      </g>
      <text x="650" y="356" fontSize="12" textAnchor="middle" className={cx(s.mono, s.fDim)}>
        {status}
      </text>
    </SceneFrame>
  );
}
