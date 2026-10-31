// What a text (the Tanakh, the Talmud) hands the app shell, and what the shell hands back.

import type {
  CameraPosition,
  Camera,
  ScreenPoint,
  Viewport,
  ItemIndex,
  MapItem,
  ItemColor,
} from '@torahmap/engine';
import type { LinkKeys, UrlState } from '@torahmap/link';
import type { Story, StoryStop } from '@torahmap/stories';
import type { Credit } from '../credits.ts';
import type { PageCopy } from './page.ts';
import type { Loaded } from '../dataFiles.ts';
import type { Overlay, SettingsUpdate, ToolOnMap } from '../overlays/types.ts';
import type { SearchTool } from './search.ts';
import type { ResolvedStoryStop } from '../scrollytelling/types.ts';
import type { PopupText } from '../sidebar.ts';
import type { TextLanguage } from '../language.ts';

/** What a text's site calls itself and its links. */
export interface Site {
  /** Its page, and its name there and everywhere. */
  page: PageCopy;
  /** Which way the text reads, and so which arrow key steps forward. */
  direction: 'rtl' | 'ltr';
  /** What a reader calls one square, in plain text: "verse", "segment". */
  squareName: string;
  /** Where a reader writes to the map's maker. */
  email: string;
  /** What the map is, as the About panel's opening paragraph. */
  aboutHtml: string;
  /** What the map itself rests on, credited above each tool's sources. */
  credits: readonly Credit[];
  /** What a link is called in a tab, in plain text. */
  title(link: UrlState): string;
}

/** What the shell downloads for a text, apart from its tools' files. */
export interface TextFiles<I> {
  /** Downloaded before the first frame. */
  first: string[];
  /** The file whose arrival and download speed load timing reports. */
  timed?: string;
  /**
   * The file a square's text in `language` is in. The shell downloads it when the popup first
   * shows that language, and shows each language as soon as its own file is in.
   */
  popup(item: I, language: TextLanguage): string;
}

export interface MapText<I extends MapItem, S = unknown> {
  site: Site;
  link: LinkKeys;
  /** The languages its popup gives. With two, the reader chooses which to show. */
  languages: readonly TextLanguage[];
  files: TextFiles<I>;
  /** The text, laid out from its first files. */
  open(loaded: Loaded): OpenText<I, S>;
}

/** A text once its first files are in. */
interface OpenText<I extends MapItem, S = unknown> {
  items: I[];
  startCamera(viewport: Viewport): Camera;
  /** A square's colour while no tool colours it. */
  baseColor(item: I, index: number): ItemColor;
  /** A square's ring while no tool rings it, or null for none. */
  baseRing?(item: I, index: number): ItemColor | null;
  /** While search alone is on, how much of its base colour a square it does not find keeps; without it, the square goes grey. */
  searchKeepsBase?: number;
  /** Draws the labels into `container`; the function returned moves them with the map. */
  labels(container: HTMLElement): (offset: ScreenPoint, zoom: number) => void;
  /** What a square's popup says; the shell marks it and makes its words clickable. `search` is what is searched, for a text whose popup shows only the words around a hit. */
  popupText(
    item: I,
    loaded: Loaded,
    overlay: ToolOnMap<I> | null,
    search?: ToolOnMap<I> | null,
  ): PopupText;
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
  /** Reads a reference typed in the Go to panel. */
  goTo: GoTo;
  /** For telemetry: a square's book or tractate, and its section. */
  area(item: I): { area: string; section: string };
  /** Wires the text's own parts to the running shell. */
  start?(shell: Shell<I, S>): void;
}

/** A place a reference names: what readers call it, and its squares' ids in reading order. */
export interface Reference {
  ref: string;
  ids: readonly string[];
}

/** Reads what is typed in the Go to box. */
export interface GoTo {
  /** Examples offered under the box, to try. */
  examples: readonly string[];
  /** The place `typed` names, or null when it names none. */
  read(typed: string): Reference | null;
  /** What `typed` may be completed to, in the order to offer them. */
  complete(typed: string): string[];
  /** The language `typed` is written in, which the offer quotes first. */
  languageOf(typed: string): TextLanguage;
}

/** What a text's own code may ask of the shell. */
export interface Shell<I extends MapItem, S = unknown> {
  loaded(): Loaded;
  searchSettings(): S;
  /** Change the search as the reader did, and open its panel. */
  changeSearch(update: SettingsUpdate<S>): void;
  /** Hold the popup while something is open over it; the function returned releases the hold. */
  holdPopup(): () => void;
  /** Pin a square and travel to it, as a search result does. */
  pinAndGlide(item: I): void;
  /**
   * Show `overlay` with its settings changed by `update`, and open its panel. An overlay not
   * showing starts from its default settings.
   */
  openOverlay<O>(overlay: Overlay<I, O>, update: SettingsUpdate<O>): void;
  /** The text's stories changed, as they do when one is edited on the dev server. */
  storiesChanged(list: readonly Story[]): void;
}
