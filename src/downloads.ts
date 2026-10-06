// What downloads when, and what a file landing puts out of date. The shell draws
// the map from the text's first files and loads every other file behind it.
import { dataFor, optionalFiles, requiredFiles, type Loaded } from './dataFiles.ts';
import type { Overlay } from './overlays/types.ts';
import type { ColorSource } from './scrollytelling/driver.ts';

/** What the first view shows: the tools it names, and the file its pinned square is in, if it pins one. */
export interface OpeningView<T> {
  tools: readonly Overlay<T>[];
  popup: string | null;
}

/** The files the opening view requires, its pinned square's among them. */
export function filesFirst<T>(view: OpeningView<T>): string[] {
  return [...new Set([...view.tools.flatMap(requiredFiles), ...(view.popup ? [view.popup] : [])])];
}

/**
 * The downloads in the order they run, each stage once the one before has
 * settled: the opening view's files, every other file a tool requires, then
 * the optional ones. A file shares the connection with fewer others, so the
 * opening view fills in sooner. Files already loaded, and empty stages, are
 * left out.
 */
export function downloadStages<T>(
  first: readonly string[],
  overlays: readonly Overlay<T>[],
  loaded: Loaded,
): string[][] {
  const taken = new Set(loaded.keys());
  const stages: string[][] = [];
  for (const stage of [first, overlays.flatMap(requiredFiles), overlays.flatMap(optionalFiles)]) {
    const fresh = [...new Set(stage)].filter((path) => !taken.has(path));
    for (const path of fresh) taken.add(path);
    if (fresh.length > 0) stages.push(fresh);
  }
  return stages;
}

/** The downloads the shell has not heard back from, the ones that failed, and the warnings closed. */
export interface Downloads {
  pending: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  closed: ReadonlySet<string>;
}

/** What a place waiting on a file says. */
export type LoadState = 'loading' | 'failed';

/**
 * What a place waiting on `paths` says: 'failed' once one has failed, until
 * the reader closes the warning; 'loading' while one is on its way.
 */
export function waitingOn(paths: readonly string[], downloads: Downloads): LoadState | null {
  const failed = paths.filter((path) => downloads.failed.has(path));
  if (failed.length > 0)
    return failed.every((path) => downloads.closed.has(path)) ? null : 'failed';
  return paths.some((path) => downloads.pending.has(path)) ? 'loading' : null;
}

/** What the map, the panels and the popup are drawn from as a file lands. */
export interface LandingView<T> {
  /** Where the map's colours come from: colorSource(driver). */
  source: ColorSource;
  /**
   * The tools the map shows once their data is in: the picked overlay and the
   * search while it has a word, or the tools of the stops a story blend or
   * ease is between.
   */
  map: readonly Overlay<T>[];
  /** The overlay whose controls are drawn. Search's always are. */
  panel: Overlay<T> | null;
  search: Overlay<T>;
  /** The file the square the popup shows is in, or null with no popup. */
  popup: string | null;
}

export interface Stale {
  map: ColorSource | null;
  overlayPanel: boolean;
  searchPanel: boolean;
  /** The search results already listed, quoted from data the panel was not redrawn for. */
  searchResults: boolean;
  popup: boolean;
}

/**
 * What a file landing put out of date: whatever is drawn from a tool whose
 * data it changed. The map and the panels are drawn from the files a tool
 * requires; the popup also from its optional files, and from the file its
 * square's text is in. The search results also quote from search's optional
 * file, and are quoted again in place for it rather than redrawn, so a reader
 * keeps their place.
 */
export function staleAfterLanding<T>(before: Loaded, after: Loaded, view: LandingView<T>): Stale {
  const drawn = (tool: Overlay<T>): boolean => changed(tool, before, after, requiredFiles(tool));
  const read = (tool: Overlay<T>): boolean => changed(tool, before, after, null);
  return {
    map: view.map.some(drawn) ? view.source : null,
    overlayPanel: view.panel !== null && drawn(view.panel),
    searchPanel: drawn(view.search),
    searchResults: read(view.search) && !drawn(view.search),
    popup:
      view.popup !== null &&
      (before.get(view.popup) !== after.get(view.popup) ||
        read(view.search) ||
        (view.panel !== null && read(view.panel))),
  };
}

/** Whether a tool's data changed, through one of `paths` if given. */
function changed<T>(
  tool: Overlay<T>,
  before: Loaded,
  after: Loaded,
  paths: readonly string[] | null,
): boolean {
  const was = dataFor(tool, before);
  const is = dataFor(tool, after);
  if (was === is) return false;
  if (paths === null || was === null || is === null) return true;
  return paths.some((path) => before.get(path) !== after.get(path));
}
