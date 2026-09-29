import {
  linkKind,
  parseVerseFromUrl,
  type OverlayParams,
  type UrlParamValues,
  type UrlState,
} from '@torahmap/link';
import { centreForFocus, type Camera, type ScreenPoint, type Viewport } from './camera.ts';
import type { TanakhIdentity } from './types.ts';

/** Whether a link opens with the story showing, or with it folded and the controls open. */
export type AppMode = 'story' | 'explore';

/**
 * Everything a link decides, with nothing left out. A field the link does not
 * mention holds its default, so applying a view replaces the one on screen
 * rather than layering over it.
 */
export interface ViewState {
  mode: AppMode;
  story: string | null;
  stop: string | null;
  overlay: string;
  overlayParams: OverlayParams;
  searchParams: UrlParamValues;
  verse: TanakhIdentity | null;
  camera: Camera;
}

/**
 * A stop link, or one that names nothing at all, is the story. Any other link
 * is Explore, including one that carries only a camera. A stop link is read
 * as writeLink writes it, by its story and stop alone.
 */
export function resolveViewState(
  link: UrlState,
  defaultCamera: Camera,
  isOverlay: (id: string) => boolean,
): ViewState {
  const kind = linkKind(link);
  const url: UrlState =
    kind === 'stop' ? { story: link.story, stop: link.stop, overlayParams: {} } : link;
  const overlay = url.overlay !== undefined && isOverlay(url.overlay) ? url.overlay : 'none';

  return {
    mode: kind === 'view' ? 'explore' : 'story',
    story: url.story ?? null,
    stop: url.stop ?? null,
    overlay,
    overlayParams: overlay === 'none' ? {} : url.overlayParams,
    searchParams: url.searchParams ?? {},
    verse: url.verse ? parseVerseFromUrl(url.verse) : null,
    camera: {
      zoom: url.zoom ?? defaultCamera.zoom,
      x: url.x ?? defaultCamera.x,
      y: url.y ?? defaultCamera.y,
    },
  };
}

/** A story folded earlier in the session opens folded, unless the link names a stop. */
export function opensFolded(link: UrlState, storyWasFolded: boolean): boolean {
  return storyWasFolded && linkKind(link) !== 'stop';
}

/**
 * The camera a view lands on: its zoom, then its position, then its verse at
 * `focus`. The verse is placed last so that it is placed at the zoom the link
 * asked for; placing it first and zooming after moves it off screen.
 */
export function cameraForView(
  camera: Camera,
  verse: { x: number; y: number; size: number } | null,
  focus: ScreenPoint,
  viewport: Viewport,
): Camera {
  if (!verse) return { ...camera };
  return { ...centreForFocus(verse, camera.zoom, focus, viewport), zoom: camera.zoom };
}
