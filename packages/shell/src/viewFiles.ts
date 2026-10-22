// The files what the reader sees needs, fetched as soon as it needs them, and
// what each place shows while they are on their way or failed. The shell says
// what is shown: the tools, the pinned square, the story's stop.
import { requiredFiles } from './dataFiles.ts';
import type { LandingView, OpeningView } from './downloads.ts';
import type { ColorSource } from './scrollytelling/driver.ts';
import { shownLanguages } from './languageChoice.ts';
import type { TextLanguage } from './language.ts';
import { LOADING, loadNotice } from './loadNotice.ts';
import type { LegendRow } from './mapLegend.ts';
import type { FrontTool } from './frame.ts';
import type { Loader } from './loader.ts';
import type { Overlay } from './overlays/types.ts';
import type { SearchTool } from './app/search.ts';
import type { TextFiles } from './app/text.ts';

export interface ViewFiles<I> {
  /** What the first view shows, with `tools` on and `item`'s popup open. */
  opening(tools: readonly Overlay<I>[], item: I | null): OpeningView<I>;
  /** What is drawn as a file lands, with `map` coloured and `shown`'s popup open. */
  landing(
    source: ColorSource,
    map: readonly Overlay<I>[],
    panel: Overlay<I> | null,
    shown: I | null,
  ): LandingView<I>;
  /** Each shown language of `item`'s popup, and the file its words are in. */
  popupFiles(item: I): { language: TextLanguage; file: string }[];
  /** Fetches `item`'s popup files for the languages shown. */
  fetchPopup(item: I | null): void;
  /** Fetches the files the search's settings ask for at once. */
  fetchSearch(): void;
  /** The shown languages of `item`'s popup whose file is not in, with one notice for each file. */
  waitingLanguages(item: I): Partial<Record<TextLanguage, Node | null>>;
  /**
   * What the legend shows for a picked tool without its data: a card saying its
   * files are on their way, a warning that one failed, or nothing.
   */
  waitingTool(
    panel: FrontTool,
    tool: Overlay<I>,
  ): { row: LegendRow } | { warning: HTMLElement } | null;
  /** Says in the search caption that search's files are loading or failed; search fills it once they are in. */
  showSearchNotice(): void;
}

export function createViewFiles<I>(options: {
  loader: Loader;
  files: TextFiles<I>;
  search: SearchTool<I>;
  searchSettings(): unknown;
  searchControls: HTMLElement;
  /** The reader closed a warning: every place that says a file is loading or failed redraws. */
  closed(): void;
}): ViewFiles<I> {
  const { loader, files, search, searchControls } = options;

  /** Each shown language of `item`'s popup, and the file its words are in. */
  const languageFiles = (item: I): { language: TextLanguage; file: string }[] =>
    shownLanguages().map((language) => ({ language, file: files.popup(item, language) }));

  /** The files `item`'s popup needs for the languages shown; none without an item. */
  const popupFiles = (item: I | null): string[] =>
    item ? [...new Set(languageFiles(item).map(({ file }) => file))] : [];

  const searchFiles = (): readonly string[] => search.filesNow?.(options.searchSettings()) ?? [];

  /** What a place waiting on `paths` shows: a loading notice, a closable warning, or nothing. */
  function noticeFor(paths: readonly string[]): HTMLElement | null {
    const state = loader.waitingOn(paths);
    return (
      state &&
      loadNotice(state, () => {
        loader.close(paths);
        options.closed();
      })
    );
  }

  return {
    opening: (tools, item) => ({ tools, popup: popupFiles(item), searchFiles: searchFiles() }),
    landing: (source, map, panel, shown) => ({
      source,
      map,
      panel,
      search,
      popup: popupFiles(shown),
    }),
    popupFiles: languageFiles,
    fetchPopup(item) {
      for (const file of popupFiles(item)) loader.fetchNow(file);
    },
    fetchSearch() {
      for (const file of searchFiles()) loader.fetchNow(file);
    },
    waitingLanguages(item) {
      const waiting: Partial<Record<TextLanguage, Node | null>> = {};
      const told = new Set<string>();
      for (const { language, file } of languageFiles(item)) {
        if (loader.waitingOn([file]) === null) continue;
        waiting[language] = told.has(file) ? null : noticeFor([file]);
        told.add(file);
      }
      return waiting;
    },
    waitingTool(panel, tool) {
      const required = requiredFiles(tool);
      if (loader.waitingOn(required) === 'loading')
        return { row: { panel, name: tool.name, summary: { detail: LOADING }, loading: true } };
      const warning = noticeFor(required);
      return warning && { warning };
    },
    showSearchNotice() {
      const caption = searchControls.querySelector('#search-hit-caption');
      if (!caption) return;
      const notice = noticeFor([...requiredFiles(search), ...searchFiles()]);
      if (notice) caption.replaceChildren(notice);
      else caption.querySelector('.load-notice')?.remove();
    },
  };
}
