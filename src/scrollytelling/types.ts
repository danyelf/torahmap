import type { CameraPosition, StoryStop } from '@torahmap/stories';

/** A StoryStop with camera resolved to actual coordinates */
export interface ResolvedStoryStop extends Omit<StoryStop, 'camera'> {
  camera: CameraPosition;
}

export interface InterpolatedState {
  camera: CameraPosition;
  fromStop: ResolvedStoryStop;
  toStop: ResolvedStoryStop;
  t: number; // 0-1 raw progress between stops
}
