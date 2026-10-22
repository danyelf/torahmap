// Runs the downloads behind the first frame: what has landed, what is on its
// way or failed, a file fetched ahead of its stage, search's prebuild and load
// timing. The shell hears when a file lands or fails and redraws.
import { downloadKbps, trackLoadTiming } from './analytics.ts';
import { dataFor, downloadFiles, type Loaded } from './dataFiles.ts';
import { downloadStages, waitingOn, type LoadState } from './downloads.ts';
import { prebuildCompleted } from './overlays/prebuild.ts';
import type { Overlay } from './overlays/types.ts';
import type { SearchTool } from './app/search.ts';

export interface Loader {
  /** What has landed so far. */
  loaded(): Loaded;
  /** What a place waiting on `paths` says, as waitingOn. */
  waitingOn(paths: readonly string[]): LoadState | null;
  /**
   * A file a popup or a search needs now: downloaded at once, ahead of its
   * stage if it is waiting in one, unless it is in or its download has begun.
   * Until run starts, the opening view's files are left to its first stage.
   */
  fetchNow(path: string): void;
  /** The reader closed the warning for `paths`: it stays closed for the failed ones. */
  close(paths: readonly string[]): void;
  /**
   * Download everything in stages, the files `first` names before the rest.
   * `drawn` runs once every file is counted as on its way, as the first frame shows.
   */
  run(first: readonly string[], drawn: () => void): Promise<void>;
}

export function createLoader<I>(options: {
  first: Loaded;
  overlays: readonly Overlay<I>[];
  search: SearchTool<I>;
  /** The file load timing's texts_in marks. */
  timedFile?: string;
  landed(before: Loaded, after: Loaded): void;
  failed(): void;
}): Loader {
  const { overlays, search, timedFile } = options;
  let loaded = options.first;
  /** Every file not yet in: each stage's, from before the first frame, and any fetched at once. */
  const pending = new Set<string>();
  /** The files whose download has begun: a stage's once it starts, and any fetched at once. */
  const started = new Set<string>();
  const failed = new Set<string>();
  const closed = new Set<string>();
  let stagesBegun = false;

  // For load_timing (sendLoadTiming).
  let firstFrame = 0;
  let timedIn = 0;
  let searchReady = 0;
  let searchPrebuilt = false;
  let settled = false;
  let timingSent = false;

  function fileLanded(path: string, content: unknown): void {
    if (path === timedFile) timedIn = performance.now();
    pending.delete(path);
    const before = loaded;
    loaded = new Map(before).set(path, content);
    // Before the redraws, so one that throws cannot hold back load timing.
    prebuildCompleted(overlays, before, loaded, prebuilt);
    const data = dataFor(search, loaded);
    if (data && data !== dataFor(search, before)) search.telemetry.dataLoaded(data);
    options.landed(before, loaded);
  }

  function fileFailed(path: string): void {
    pending.delete(path);
    failed.add(path);
    options.failed();
  }

  const handlers = { landed: fileLanded, failed: fileFailed };

  function prebuilt(overlay: Overlay<I>, built: boolean): void {
    if (overlay !== search) return;
    searchPrebuilt = true;
    if (built) searchReady = performance.now();
    sendLoadTiming();
  }

  /** Sends load_timing once its fields are known; @torahmap/telemetry says what each marks. */
  function sendLoadTiming(): void {
    if (timingSent || !settled) return;
    if (dataFor(search, loaded) && !searchPrebuilt) return;
    timingSent = true;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const timedEntry = timedFile
      ? resources.find((e) => e.name.endsWith(`/${timedFile}`))
      : undefined;
    const connection = (navigator as { connection?: { effectiveType?: string } }).connection;
    trackLoadTiming({
      first_frame: Math.round(firstFrame),
      texts_in: Math.round(timedIn),
      search_ready: Math.round(searchReady),
      texts_kbps: downloadKbps(timedEntry),
      connection: connection?.effectiveType ?? '',
    });
  }

  return {
    loaded: () => loaded,
    waitingOn: (paths) => waitingOn(paths, { pending, failed, closed }),
    fetchNow(path) {
      if (!stagesBegun) return;
      if (loaded.has(path) || started.has(path)) return;
      started.add(path);
      pending.add(path);
      void downloadFiles([path], handlers);
    },
    close(paths) {
      for (const path of paths) if (failed.has(path)) closed.add(path);
    },
    async run(first, drawn) {
      const stages = downloadStages(first, overlays, loaded);
      for (const path of stages.flat()) pending.add(path);
      stagesBegun = true;

      // The loading tests wait on this; nothing in the app reads it.
      document.documentElement.dataset.firstFrame = '';
      firstFrame = performance.now();
      drawn();

      for (const stage of stages) {
        const fresh = stage.filter((path) => !started.has(path));
        for (const path of fresh) started.add(path);
        await downloadFiles(fresh, handlers);
      }
      // The layout tests, the video harness and the loading tests wait on this;
      // nothing in the app reads it.
      document.documentElement.dataset.loaded = '';
      settled = true;
      sendLoadTiming();
    },
  };
}
