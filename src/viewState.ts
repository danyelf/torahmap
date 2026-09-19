import { parseVerseFromUrl, type OverlayParams, type UrlState } from './urlState.ts';
import { panToCenter, type Camera } from './camera.ts';
import type { Mode } from './scrollytelling/modeSwitch.ts';
import type { TanakhIdentity } from './types.ts';

/**
 * Everything a link decides, with nothing left out. A field the link does not
 * mention holds its default, so applying a view replaces the one on screen
 * rather than layering over it.
 */
export interface ViewState {
  mode: Mode;
  storyStop: string | null;
  overlay: string;
  overlayParams: OverlayParams;
  verse: TanakhIdentity | null;
  camera: Camera;
}

/**
 * A link that names a story stop, or names nothing at all, is the story. Any
 * other link is Explore, including one that carries only a camera.
 */
export function resolveViewState(
  url: UrlState,
  defaultCamera: Camera,
  isOverlay: (id: string) => boolean,
): ViewState {
  const namesNothing =
    url.overlay === undefined &&
    url.verse === undefined &&
    url.zoom === undefined &&
    url.x === undefined &&
    url.y === undefined;
  const overlay = url.overlay !== undefined && isOverlay(url.overlay) ? url.overlay : 'none';

  return {
    mode: url.story || namesNothing ? 'story' : 'explore',
    storyStop: url.story ?? null,
    overlay,
    overlayParams: overlay === 'none' ? {} : url.overlayParams,
    verse: url.verse ? parseVerseFromUrl(url.verse) : null,
    camera: {
      zoom: url.zoom ?? defaultCamera.zoom,
      x: url.x ?? defaultCamera.x,
      y: url.y ?? defaultCamera.y,
    },
  };
}

/**
 * The camera a view lands on: its zoom, then its position, then centred on its
 * verse. The verse is centred last so that it is centred at the zoom the link
 * asked for; centring first and zooming after moves it off screen.
 */
export function cameraForView(
  camera: Camera,
  verse: { x: number; y: number; size: number } | null,
  cssWidth: number,
  cssHeight: number,
): Camera {
  if (!verse) return { ...camera };
  return { ...panToCenter(verse, camera.zoom, cssWidth, cssHeight), zoom: camera.zoom };
}
