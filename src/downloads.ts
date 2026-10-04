// What downloads when, and what a file landing puts out of date. Main draws
// the map from the structure alone and loads every other file behind it.
import { TEXTS_FILE } from './verseTexts.ts';
import { dataFor, optionalFiles, requiredFiles, type Loaded } from './dataFiles.ts';
import { searchTool } from './overlays/search/index.ts';
import type { TanakhOverlay } from './overlays/index.ts';
import type { ColorSource } from './scrollytelling/driver.ts';

/** What the first view shows: the tools it names, and whether it pins a verse. */
export interface OpeningView {
  tools: readonly TanakhOverlay[];
  verse: boolean;
}

/** The files the opening view requires, the texts among them if it pins a verse. */
export function filesFirst(view: OpeningView): string[] {
  return [...new Set([...view.tools.flatMap(requiredFiles), ...(view.verse ? [TEXTS_FILE] : [])])];
}

/**
 * The downloads in the order they run, each stage once the one before has
 * settled: the opening view's files, every other file a tool requires, then
 * the optional ones. A file shares the connection with fewer others, so the
 * opening view fills in sooner. Files already loaded, and empty stages, are
 * left out.
 */
export function downloadStages(
  first: readonly string[],
  overlays: readonly TanakhOverlay[],
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

/** The downloads main has not heard back from, the ones that failed, and the warnings closed. */
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
export interface LandingView {
  /** Where the map's colours come from: colorSource(driver). */
  source: ColorSource;
  /**
   * The tools the map shows once their data is in: the picked overlay and the
   * search while it has a word, or the tools of the stops a story blend or
   * ease is between.
   */
  map: readonly TanakhOverlay[];
  /** The overlay whose controls are drawn. Search's always are. */
  panel: TanakhOverlay | null;
  /** Whether the popup shows a verse. */
  popup: boolean;
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
 * requires; the popup also from its optional files, and from the texts. The
 * search results also quote from search's optional file, and are quoted again
 * in place for it rather than redrawn, so a reader keeps their place.
 */
export function staleAfterLanding(before: Loaded, after: Loaded, view: LandingView): Stale {
  const drawn = (tool: TanakhOverlay): boolean => changed(tool, before, after, requiredFiles(tool));
  const read = (tool: TanakhOverlay): boolean => changed(tool, before, after, null);
  return {
    map: view.map.some(drawn) ? view.source : null,
    overlayPanel: view.panel !== null && drawn(view.panel),
    searchPanel: drawn(searchTool),
    searchResults: read(searchTool) && !drawn(searchTool),
    popup:
      view.popup &&
      (before.get(TEXTS_FILE) !== after.get(TEXTS_FILE) ||
        read(searchTool) ||
        (view.panel !== null && read(view.panel))),
  };
}

/** Whether a tool's data changed, through one of `paths` if given. */
function changed(
  tool: TanakhOverlay,
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
