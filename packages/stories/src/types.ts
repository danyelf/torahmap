import type { CameraPosition, EasingName } from '@torahmap/engine';

/**
 * Camera reference: an explicit position, the app's initial camera, or places
 * to fit in view together. Each text says what its place names mean.
 */
export type CameraRef = CameraPosition | 'initial' | { kind: 'places'; names: string[] };

export interface StoryStop {
  id: string;
  title?: string;
  text: string;
  camera: CameraRef;
  overlay: string | null;
  overlayParams?: Record<string, string>;
  searchParams?: Record<string, string>; // the search's own keys: search, mode, m
  pin?: string; // the id of the square this stop pins
  easing?: EasingName;
  zoom?: number; // zoom for a camera on one square, or instead of fitting places
}

export interface StoryData {
  stops: StoryStop[];
  /** Shown in the Stories panel and the menu; empty if the file gives none. */
  title: string;
  description: string;
  /** Where the story sits in the menu; stories without one come after. */
  order?: number;
  /** Listed while it is being written, except on the live site. */
  draft: boolean;
  /** How the camera moves between stops, unless a stop says otherwise. */
  easing?: EasingName;
}

/** A story and the file name, without `.md`, that the URL calls it by. */
export interface Story {
  id: string;
  data: StoryData;
}
