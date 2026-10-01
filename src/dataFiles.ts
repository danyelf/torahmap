// The loader for the overlays' data files and main's own two (structure and texts).
// Paths are under public/data/.
import { fetchData } from './constants.ts';
import { reportError } from './analytics.ts';
import type { Overlay, OptionalFile } from './overlays/types.ts';

/** What has arrived, by path. A file that failed is absent. */
export type Loaded = ReadonlyMap<string, unknown>;

/**
 * Download each path once. A failure is reported and leaves that path missing.
 * `onLoaded` is called for each path as it arrives.
 */
export async function loadFiles(
  paths: Iterable<string>,
  onLoaded?: (path: string) => void,
): Promise<Loaded> {
  const unique = [...new Set(paths)];
  const contents = await Promise.all(
    unique.map(async (path) => {
      const content = await loadFile(path);
      if (content !== undefined) onLoaded?.(path);
      return content;
    }),
  );
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

export type { OptionalFile };

/** A file named by its path, or an optional one. */
export type FileName = string | OptionalFile;

export function optional(path: string): OptionalFile {
  return { optional: path };
}

function pathOf(file: FileName): string {
  return typeof file === 'string' ? file : file.optional;
}

/** The paths of a set of named files. */
export function filePaths(files: Readonly<Record<string, FileName>>): string[] {
  return Object.values(files).map(pathOf);
}

/**
 * Each named file's contents under its name, or null while a file that is not
 * optional is missing. A missing optional file is null.
 */
export function filesFor<D>(files: Readonly<Record<string, FileName>>, loaded: Loaded): D | null {
  const named = Object.entries(files);
  if (!named.every(([, file]) => typeof file !== 'string' || loaded.has(file))) return null;
  return Object.fromEntries(
    named.map(([name, file]) => [name, loaded.get(pathOf(file)) ?? null]),
  ) as D;
}

/** Load the named files and give them under their names; throw naming any required one that is missing. */
export async function loadNamedFiles<D>(files: Readonly<Record<string, FileName>>): Promise<D> {
  const loaded = await loadFiles(filePaths(files));
  const data = filesFor<D>(files, loaded);
  if (!data) {
    const missing = Object.values(files).filter(
      (file): file is string => typeof file === 'string' && !loaded.has(file),
    );
    throw new Error(`Could not load ${missing.join(', ')}`);
  }
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
    byOverlay.set(overlay, filesFor<D>(overlay.data as Record<string, FileName>, loaded));
  }
  return byOverlay.get(overlay) as D | null;
}

/** Every path the overlays name. */
export function overlayFiles(overlays: readonly Overlay[]): string[] {
  return overlays.flatMap((overlay) => filePaths((overlay.data ?? {}) as Record<string, FileName>));
}
