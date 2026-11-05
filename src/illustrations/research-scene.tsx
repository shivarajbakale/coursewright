import { Caption, Rule, SceneFrame, Sheet } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';

const FALLBACK = ['Key ideas', 'Core terms', 'Examples', 'Pitfalls', 'Prerequisites'];

/** The source card's ruled lines; the reading band steps 24 units per line. */
const LINES = [232, 200, 216, 184, 208];

/** Stage 1: a source card being read, line by line, and the terms taken from it. */
export function ResearchScene({ data, height }: SceneProps) {
  const terms = pick(data.terms, FALLBACK)
    .slice(0, 5)
    .map(t => trunc(t, 22));
  const topic = data.topic?.trim() || 'Your topic';
  const count = data.terms?.length ?? 0;

  return (
    <SceneFrame
      height={height}
      label={`Researching ${trunc(topic, 60)}: a source card being read line by line, with the terms taken from it: ${terms.join(', ')}`}
    >
      {/* Source cards: two behind, the one being read in front. */}
      <Sheet x={144} y={64} w={272} h={240} tone="back" />
      <Sheet x={132} y={76} w={272} h={240} tone="back" />
      <Sheet x={120} y={88} w={272} h={240} />
      <text x="144" y="124" fontSize="14" fontWeight="500" className={s.text}>
        {trunc(topic, 30)}
      </text>
      <line x1="144" y1="144" x2="368" y2="144" className={s.line} />
      <rect
        data-slot="scene-progress"
        x="136"
        y="164"
        width="240"
        height="20"
        rx="4"
        className={cx(s.wash, s.read)}
      />
      {LINES.map((w, i) => (
        <Rule key={i} x={144} y={172 + i * 24} w={w} />
      ))}
      <Rule x={144} y={292} w={120} />

      {/* What has been taken from it. */}
      <Sheet x={456} y={88} w={224} h={240} />
      <text x="480" y="124" fontSize="14" className={s.dim}>
        Terms
      </text>
      <line x1="480" y1="144" x2="656" y2="144" className={s.line} />
      {terms.map((term, i) => (
        <text key={i} x="480" y={180 + i * 28} fontSize="14" className={s.text}>
          {term}
        </text>
      ))}

      <Caption
        label="Reading sources"
        figure={count ? `${count} term${count === 1 ? '' : 's'}` : undefined}
      />
    </SceneFrame>
  );
}
