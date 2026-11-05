import { Caption, Rule, SceneFrame, Sheet } from './scene-kit';
import { cx, paint as s, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';

/** Index tabs on the cards already filed, left to right, back to front. */
const TABS = [272, 336, 400, 464];

/** Stage 6: chapter cards being filed into an index drawer. */
export function IndexScene({ data, height }: SceneProps) {
  const chapters = data.chapterTotal ?? data.chapters?.length ?? 0;
  const chunks = data.chunks ?? 0;
  const heading = trunc(data.chapters?.[0] ?? data.topic ?? '', 30);

  const figures = [
    chunks > 0 ? `${chunks.toLocaleString('en-US')} chunks` : '',
    chapters ? `${chapters} chapter${chapters === 1 ? '' : 's'}` : '',
  ].filter(Boolean);

  return (
    <SceneFrame
      height={height}
      label={`Chapter cards being filed into an index drawer${figures.length ? `: ${figures.join(', ')}` : ''}`}
    >
      {/* Cards already filed: only their tabs show above the drawer. */}
      {TABS.map(tx => (
        <path
          key={tx}
          d={`M${tx} 208 v-12 a4 4 0 0 1 4 -4 h48 a4 4 0 0 1 4 4 v12`}
          className={s.paperBack}
        />
      ))}
      <rect x="256" y="204" width="288" height="40" rx="4" className={s.paperBack} />

      {/* The card being filed now; it slides down behind the drawer front. */}
      <g data-slot="scene-progress" className={s.file}>
        <Sheet x={256} y={56} w={288} h={112} tone="now" />
        {heading ? (
          <text x="280" y="92" fontSize="14" className={s.text}>
            {heading}
          </text>
        ) : (
          <Rule x={280} y={84} w={120} />
        )}
        <Rule x={280} y={116} w={224} />
        <Rule x={280} y={136} w={184} />
      </g>

      {/* The drawer front, its label holder carrying the chunk count. */}
      <rect x="240" y="224" width="320" height="120" rx="8" className={s.paper} />
      <rect x="352" y="252" width="96" height="32" rx="4" className={s.line} />
      <text
        x="400"
        y="273"
        fontSize="14"
        textAnchor="middle"
        className={chunks > 0 ? cx(s.mono, s.dim) : s.dim}
      >
        {chunks > 0 ? chunks.toLocaleString('en-US') : 'Index'}
      </text>
      <rect x="376" y="308" width="48" height="12" rx="6" className={s.line} />

      <Caption label="Filing chapters into the index" figure={figures.join(' · ') || undefined} />
    </SceneFrame>
  );
}
