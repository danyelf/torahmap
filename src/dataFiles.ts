// The loader for the overlays' data files and main's own two (structure and texts).
// Paths are under public/data/; what a file means belongs to whoever names it.
import { fetchData } from './constants.ts';
import { reportError } from './analytics.ts';
import type { Overlay } from './overlays/types.ts';

/** What has arrived, by path. A file that failed is absent. */
export type Loaded = ReadonlyMap<string, unknown>;

/** Download each path once. A failure is reported and leaves that path missing. */
export async function loadFiles(paths: Iterable<string>): Promise<Loaded> {
  const unique = [...new Set(paths)];
  const contents = await Promise.all(unique.map(loadFile));
  return new Map(
    unique.flatMap((path, i) => (contents[i] === undefined ? [] : [[path, contents[i]] as const])),
  );
}

async function loadFile(path: string): Promise<unknown> {
  try {
    const response = await fetchData(path);
    if (!response.ok) {
      reportError('loadFiles', response.status, `Failed to load ${path}`);
      return undefined;
    }
    return await response.json();
  } catch (e) {
    reportError('loadFiles', e, `Failed to load ${path}`);
    return undefined;
  }
}

/** Each named file's contents under its name, or null while any is missing. */
export function filesFor<D>(files: Readonly<Record<string, string>>, loaded: Loaded): D | null {
  const named = Object.entries(files);
  if (!named.every(([, path]) => loaded.has(path))) return null;
  return Object.fromEntries(named.map(([name, path]) => [name, loaded.get(path)])) as D;
}

/** Load the named files and give them under their names; throw naming any that is missing. */
export async function loadNamedFiles<D>(files: Readonly<Record<string, string>>): Promise<D> {
  const paths = Object.values(files);
  const loaded = await loadFiles(paths);
  const data = filesFor<D>(files, loaded);
  if (!data) throw new Error(`Could not load ${paths.filter((p) => !loaded.has(p)).join(', ')}`);
  return data;
}

// Per loaded value, so that the same files give each overlay the same object.
const given = new WeakMap<Loaded, Map<object, unknown>>();

/**
 * An overlay's files under its own names, or null while any is missing. The
 * same loaded value gives the same object, so what an overlay keeps per data
 * value is found again. An overlay that names no files gets undefined.
 */
export function dataFor<T, S, D>(overlay: Overlay<T, S, D>, loaded: Loaded): D | null {
  if (!overlay.data) return undefined as D;
  let byOverlay = given.get(loaded);
  if (!byOverlay) {
    byOverlay = new Map();
    given.set(loaded, byOverlay);
  }
  if (!byOverlay.has(overlay)) {
    byOverlay.set(overlay, filesFor<D>(overlay.data as Record<string, string>, loaded));
  }
  return byOverlay.get(overlay) as D | null;
}

/** Every path the overlays name. */
export function overlayFiles(overlays: readonly Overlay[]): string[] {
  return overlays.flatMap((overlay) =>
    Object.values((overlay.data ?? {}) as Record<string, string>),
  );
}
