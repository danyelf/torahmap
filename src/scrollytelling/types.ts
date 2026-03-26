// src/scrollytelling/types.ts

export interface CameraPosition {
  x: number;
  y: number;
  zoom: number;
}

export interface StoryStop {
  id: string;
  title: string;
  text: string;
  camera: CameraPosition | 'initial';
  overlay: string | null;
  overlayParams?: Record<string, string>;
  easing?: EasingName;
}

/** A StoryStop with camera resolved to actual coordinates */
export interface ResolvedStoryStop extends Omit<StoryStop, 'camera'> {
  camera: CameraPosition;
}

export interface StoryData {
  stops: StoryStop[];
  defaults?: {
    easing?: EasingName;
  };
}

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface InterpolatedState {
  camera: CameraPosition;
  fromStop: ResolvedStoryStop;
  toStop: ResolvedStoryStop;
  t: number; // 0-1 raw progress between stops
}
