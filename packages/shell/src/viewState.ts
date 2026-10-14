import { centreForFocus, type Camera, type ScreenPoint, type Viewport } from '@torahmap/engine';
import { linkKind, type OverlayParams, type UrlParamValues, type UrlState } from '@torahmap/link';
import type { Frame } from './frame.ts';
import { NO_OVERLAY } from './overlays/types.ts';

/**
 * Everything a link decides, with nothing left out. A field the link does not
 * mention holds its default, so applying a view replaces the one on screen
 * rather than layering over it.
 */
export interface ViewState {
  /** Whether the link opens with the story showing, or with it folded and the controls open. */
  mode: Frame['mode'];
  story: string | null;
  stop: string | null;
  overlay: string;
  overlayParams: OverlayParams;
  searchParams: UrlParamValues;
  item: string | null;
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
  const overlay = url.overlay !== undefined && isOverlay(url.overlay) ? url.overlay : NO_OVERLAY;

  return {
    mode: kind === 'view' ? 'explore' : 'story',
    story: url.story ?? null,
    stop: url.stop ?? null,
    overlay,
    overlayParams: overlay === NO_OVERLAY ? {} : url.overlayParams,
    searchParams: url.searchParams ?? {},
    item: url.square ?? null,
    camera: {
      zoom: url.zoom ?? defaultCamera.zoom,
      x: url.x ?? defaultCamera.x,
      y: url.y ?? defaultCamera.y,
    },
  };
}

/** A returning reader opens with the story folded, unless the link names a stop. */
export function opensFolded(link: UrlState, hasVisited: boolean): boolean {
  return hasVisited && linkKind(link) !== 'stop';
}

/**
 * The camera a view lands on: its zoom, then its position, then its item at
 * `focus`. The item is placed last so that it is placed at the zoom the link
 * asked for; placing it first and zooming after moves it off screen.
 */
export function cameraForView(
  camera: Camera,
  item: { x: number; y: number; size: number } | null,
  focus: ScreenPoint,
  viewport: Viewport,
): Camera {
  if (!item) return { ...camera };
  return { ...centreForFocus(item, camera.zoom, focus, viewport), zoom: camera.zoom };
}
