// What a text (the Tanakh, the Talmud) hands the app shell, and what the shell hands back.

import type { CameraPosition, Story, StoryStop } from '@torahmap/stories';
import type { Camera, ScreenPoint, Viewport } from '../camera.ts';
import type { Loaded } from '../dataFiles.ts';
import type { ItemIndex } from '../items.ts';
import type { Overlay, ToolOnMap } from '../overlays/types.ts';
import type { SearchTool } from './search.ts';
import type { ResolvedStoryStop } from '../scrollytelling/types.ts';
import type { SidebarElements } from '../sidebar.ts';
import type { MapItem, VerseColor } from '../types.ts';

export interface MapText<I extends MapItem, S = unknown> {
  /** Downloaded before the first frame. */
  firstFiles: string[];
  /** The text, laid out from its first files. */
  open(loaded: Loaded): OpenText<I, S>;
}

/** A text once its first files are in. */
export interface OpenText<I extends MapItem, S = unknown> {
  items: I[];
  startCamera(viewport: Viewport): Camera;
  /** A square's colour while no tool colours it. */
  baseColor(item: I, index: number): VerseColor;
  /** Draws the labels into `container`; the function returned moves them with the map. */
  labels(container: HTMLElement): (offset: ScreenPoint, zoom: number) => void;
  /** The file a square's text is in. The shell downloads it when the square's popup first shows. */
  popupFile(item: I): string;
  /** Shortcut: each text draws its own popup, marks and word clicks included. */
  drawPopup(elements: SidebarElements, item: I | null, view: PopupView<I>): void;
  overlays: Overlay<I>[];
  search: SearchTool<I, S>;
  stories: {
    list: readonly Story[];
    resolve(
      stops: StoryStop[],
      initialCamera: CameraPosition,
      items: I[],
      squares: ItemIndex<I>,
      focus: ScreenPoint,
      viewport: Viewport,
    ): ResolvedStoryStop[];
  };
  /** Shortcut: telemetry's events still carry a book, chapter and verse. */
  track: {
    verse(item: I): { book: string; chapter: number; verse: number };
    area(item: I): { area: string; section: string };
  };
  /** Wires the text's own parts to the running shell. */
  start?(shell: Shell<I, S>): void;
}

/** What a text's popup is drawn from. */
export interface PopupView<I extends MapItem> {
  loaded: Loaded;
  /** The loading or failed notice for the square's file, or null once it is in. */
  notice: Node | null;
  overlay: ToolOnMap<I> | null;
  search: ToolOnMap<I> | null;
  pinned: boolean;
}

/** What a text's own code may ask of the shell. */
export interface Shell<I extends MapItem, S = unknown> {
  loaded(): Loaded;
  searchSettings(): S;
  /** Change the search as the reader did, and open its panel. */
  changeSearch(update: (current: S) => S): void;
  /** Hold the popup while something is open over it; the function returned releases the hold. */
  holdPopup(): () => void;
  /** Pin a square and travel to it, as a search result does. */
  pinAndGlide(item: I): void;
  /** The text's stories changed, as they do when one is edited on the dev server. */
  storiesChanged(list: readonly Story[]): void;
}
