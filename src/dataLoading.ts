// Each tool's data is loaded by its own init, run once here. A tool whose init
// has not finished is left off the map (toolsShown, src/tools.ts).

import type { UrlState } from '@torahmap/link';
import type { StoryStop } from '@torahmap/stories';

export interface Loadable {
  id: string;
  init?(): Promise<void>;
}

const started = new Map<Loadable, Promise<void>>();
const finished = new Set<Loadable>();

/**
 * Run `tool`'s init once, however often it is asked for. A failure warns and
 * counts as finished: the tool then shows what it has, as it always has with
 * its data missing, rather than keep everything that waits on it waiting.
 */
export function ready(tool: Loadable): Promise<void> {
  let loading = started.get(tool);
  if (!loading) {
    loading = new Promise<void>((resolve) => resolve(tool.init?.()))
      .catch((err) => console.warn(`Could not load the data for ${tool.id}:`, err))
      .then(() => {
        finished.add(tool);
      });
    started.set(tool, loading);
  }
  return loading;
}

export function isReady(tool: Loadable): boolean {
  return !tool.init || finished.has(tool);
}

/**
 * What must be in before a link's first frame: the overlays and search its own
 * view and the story stop it opens show. A pinned verse needs nothing: it is
 * drawn on the map, and its popup opens when the texts arrive.
 */
export function linkNeeds(
  link: UrlState,
  stop: StoryStop | null,
): { overlays: string[]; search: boolean } {
  const overlays = [link.overlay, stop?.overlay].filter((id): id is string => !!id);
  return {
    overlays: [...new Set(overlays)],
    search: !!(link.searchParams?.search || stop?.searchParams?.search),
  };
}
