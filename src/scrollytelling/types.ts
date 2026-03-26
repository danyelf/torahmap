// src/scrollytelling/types.ts

export interface StoryStop {
  id: string;
  title: string;
  text: string;
  camera: { x: number; y: number; zoom: number };
  overlay: string | null;
  overlayParams?: Record<string, string>;
  easing?: EasingName;
}

export interface StoryData {
  stops: StoryStop[];
  defaults?: {
    easing?: EasingName;
  };
}

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface InterpolatedState {
  camera: { x: number; y: number; zoom: number };
  fromStop: StoryStop;
  toStop: StoryStop;
  t: number; // 0-1 raw progress between stops
}
