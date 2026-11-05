import type { JSX } from 'react';
import { Box } from '@mantine/core';

import s from './scene.module.css';

import { ChaptersScene } from './chapters-scene';
import { ConceptsScene } from './concepts-scene';
import { IndexScene } from './index-scene';
import { OutlineScene } from './outline-scene';
import { ProjectsScene } from './projects-scene';
import { ResearchScene } from './research-scene';
import type { SceneData, SceneProps, SceneStage } from './scene-types';

export type { SceneData, SceneProps, SceneStage } from './scene-types';
export { ChaptersScene, ConceptsScene, IndexScene, OutlineScene, ProjectsScene, ResearchScene };

const SCENES: Record<SceneStage, (props: SceneProps) => JSX.Element> = {
  research: ResearchScene,
  concepts: ConceptsScene,
  outline: OutlineScene,
  chapters: ChaptersScene,
  projects: ProjectsScene,
  index: IndexScene,
};

/**
 * The animated illustration for one course-building stage, painted with the
 * course's own words. Scales to its container's width; pass `height` to fix
 * the height instead (the drawing letterboxes inside it).
 *
 * The scene's motion is a progress indicator: it loops while the stage is
 * running (every looping element carries `data-slot="scene-progress"`) and
 * stops when `live` is false, because a build that has stopped must not look
 * busy.
 */
export function StageScene({
  stage,
  data,
  height,
  live = true,
}: {
  stage: SceneStage;
  data: SceneData;
  height?: number;
  live?: boolean;
}): JSX.Element {
  const Scene = SCENES[stage];
  return (
    <Box aria-busy={live} className={live ? undefined : s.still}>
      <Scene data={data} height={height} />
    </Box>
  );
}
