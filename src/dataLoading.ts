// Each tool's data, and any other file loaded once, is loaded by its own init,
// run once here.

export interface Loadable {
  name: string;
  init?(): Promise<void>;
}

const started = new Map<Loadable, Promise<void>>();
const finished = new Set<Loadable>();

/**
 * Run `tool`'s init once, however often it is asked for. A failure warns and
 * counts as finished: the tool then shows what it has, rather than keep
 * everything that waits on it waiting.
 */
export function ready(tool: Loadable): Promise<void> {
  let loading = started.get(tool);
  if (!loading) {
    loading = new Promise<void>((resolve) => resolve(tool.init?.()))
      .catch((err) => console.warn(`Could not load the data for ${tool.name}:`, err))
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
