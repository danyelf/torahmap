// src/scrollytelling/types.ts

export interface CameraPosition {
  x: number;
  y: number;
  zoom: number;
}

/** Camera reference: an explicit position, the app's initial camera, or a verse to center on. */
export type CameraRef =
  | CameraPosition
  | 'initial'
  | { kind: 'verse'; ref: string }; // ref in URL format, e.g. "Genesis.12.1"

export interface StoryStop {
  id: string;
  title: string;
  text: string;
  camera: CameraRef;
  overlay: string | null;
  overlayParams?: Record<string, string>;
  verse?: string; // "Genesis.1.1" format — pins this verse in the sidebar
  easing?: EasingName;
  zoom?: number; // optional zoom override (used when camera is a verse-ref)
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
