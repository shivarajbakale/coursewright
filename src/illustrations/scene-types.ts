/** The six course-building stages, in pipeline order. */
export type SceneStage = 'research' | 'concepts' | 'outline' | 'chapters' | 'projects' | 'index';

/** Live course data a scene paints with. Every field is optional. */
export interface SceneData {
  topic?: string;
  terms?: string[];
  concepts?: string[];
  modules?: string[];
  chapters?: string[];
  chapterDone?: number;
  chapterTotal?: number;
  projects?: string[];
  chunks?: number;
}

export interface SceneProps {
  data: SceneData;
  height?: number;
}
