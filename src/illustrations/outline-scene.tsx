import { Caption, Rule, SceneFrame, Sheet } from './scene-kit';
import { cx, paint as s, pick, trunc } from './scene-utils';
import type { SceneProps } from './scene-types';

const FALLBACK = ['Foundations', 'Core concepts', 'Putting it together', 'Going further'];

const X = 200;
const W = 400;
/** How much of each earlier card shows above the next one. */
const STRIP = 44;
const CARD_H = 152;

/** Stage 3: modules as index cards, stacked in prerequisite order, the newest settling on top. */
export function OutlineScene({ data, height }: SceneProps) {
  const shown = pick(data.modules, FALLBACK).slice(0, 4);
  const count = data.modules?.length ?? 0;
  const stackH = STRIP * (shown.length - 1) + CARD_H;
  // Centre the stack in the space above the caption, on the 4-unit grid.
  const top = Math.round((372 - stackH) / 2 / 4) * 4;

  return (
    <SceneFrame height={height} label={`Module cards stacking in order: ${shown.join(', ')}`}>
      {shown.map((name, i) => {
        const y = top + i * STRIP;
        const last = i === shown.length - 1;
        return (
          <g
            key={i}
            data-slot={last ? 'scene-progress' : undefined}
            className={last ? s.settle : undefined}
          >
            <Sheet x={X} y={y} w={W} h={CARD_H} tone={last ? 'now' : 'front'} />
            <text x={X + 24} y={y + 28} fontSize="14" className={cx(s.mono, s.dim)}>
              {i + 1}
            </text>
            <text x={X + 52} y={y + 28} fontSize="14" className={s.text}>
              {trunc(name, 40)}
            </text>
            {last && (
              <>
                <line
                  x1={X + 24}
                  y1={y + STRIP}
                  x2={X + W - 24}
                  y2={y + STRIP}
                  className={s.line}
                />
                <Rule x={X + 52} y={y + 68} w={280} />
                <Rule x={X + 52} y={y + 88} w={240} />
                <Rule x={X + 52} y={y + 108} w={200} />
              </>
            )}
          </g>
        );
      })}

      <Caption
        label="Ordering modules by prerequisite"
        figure={
          count ? `${count > 4 ? '4 of ' : ''}${count} module${count === 1 ? '' : 's'}` : undefined
        }
      />
    </SceneFrame>
  );
}
