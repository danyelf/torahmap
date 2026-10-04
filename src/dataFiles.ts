// The loader for the overlays' and search's data files, and main's own two
// (structure and texts).
// Paths are under public/data/.
import { fetchData } from './constants.ts';
import { reportError } from './analytics.ts';
import type { Overlay, OptionalFile } from './overlays/types.ts';

/** What has arrived, by path. A file that failed is absent. */
export type Loaded = ReadonlyMap<string, unknown>;

/**
 * Download each path once, handing each to `landed` as it arrives, or to
 * `failed` once its failure is reported. Resolves when every path has done one
 * or the other. A throw while handling one file is reported, and the others
 * are still handed over.
 */
export async function downloadFiles(
  paths: Iterable<string>,
  on: { landed(path: string, content: unknown): void; failed(path: string): void },
): Promise<void> {
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      const content = await loadFile(path);
      try {
        if (content === undefined) on.failed(path);
        else on.landed(path, content);
      } catch (e) {
        reportError('fileLanded', e, `Handling ${path}`);
      }
    }),
  );
}

/** Download each path once. A failure is reported and leaves that path missing. */
export async function loadFiles(paths: Iterable<string>): Promise<Loaded> {
  const loaded = new Map<string, unknown>();
  await downloadFiles(paths, {
    landed: (path, content) => loaded.set(path, content),
    failed: () => {},
  });
  return loaded;
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
type FileName = string | OptionalFile;

export function optional(path: string): OptionalFile {
  return { optional: path };
}

function pathOf(file: FileName): string {
  return typeof file === 'string' ? file : file.optional;
}

/** The paths of a set of named files. */
function filePaths(files: Readonly<Record<string, FileName>>): string[] {
  return Object.values(files).map(pathOf);
}

/** A set of named files' paths: the required, each named by a plain path, and the optional. */
function byNeed(files: Readonly<Record<string, FileName>>): {
  required: string[];
  optional: string[];
} {
  const required: string[] = [];
  const optional: string[] = [];
  for (const file of Object.values(files)) {
    if (typeof file === 'string') required.push(file);
    else optional.push(file.optional);
  }
  return { required, optional };
}

/** The paths of the files that are not optional and have not arrived. */
function missingRequired(files: Readonly<Record<string, FileName>>, loaded: Loaded): string[] {
  return byNeed(files).required.filter((path) => !loaded.has(path));
}

/** Each named file's contents under its name, or null while a required file is missing. */
export function filesFor<D>(files: Readonly<Record<string, FileName>>, loaded: Loaded): D | null {
  if (missingRequired(files, loaded).length > 0) return null;
  return Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, loaded.get(pathOf(file)) ?? null]),
  ) as D;
}

/**
 * Load the named files and give them under their names; throw naming any
 * required one that is missing.
 */
export async function loadNamedFiles<D>(files: Readonly<Record<string, FileName>>): Promise<D> {
  const loaded = await loadFiles(filePaths(files));
  const data = filesFor<D>(files, loaded);
  if (!data) throw new Error(`Could not load ${missingRequired(files, loaded).join(', ')}`);
  return data;
}

const namesOf = (overlay: { data?: unknown }): Readonly<Record<string, FileName>> =>
  (overlay.data ?? {}) as Readonly<Record<string, FileName>>;

/** The paths an overlay cannot work without. */
export function requiredFiles(overlay: Overlay<unknown>): string[] {
  return byNeed(namesOf(overlay)).required;
}

/** The paths an overlay is handed as null until they are in. */
export function optionalFiles(overlay: Overlay<unknown>): string[] {
  return byNeed(namesOf(overlay)).optional;
}

// Per overlay, each set of its files' contents handed out so far, with the
// data made from it.
const given = new WeakMap<object, { contents: unknown[]; data: unknown }[]>();

/**
 * An overlay's files under its own names, or null while any it requires is
 * missing. The data stays the same object while none of the overlay's own
 * files changes, however many others land, so what the overlay keeps per data
 * value is found again. An overlay that names no files gets undefined.
 */
export function dataFor<T, S, D>(overlay: Overlay<T, S, D>, loaded: Loaded): D | null {
  if (!overlay.data) return undefined as D;
  const files = namesOf(overlay);
  const contents = filePaths(files).map((path) => loaded.get(path));
  let known = given.get(overlay);
  if (!known) {
    known = [];
    given.set(overlay, known);
  }
  const found = known.find((entry) => entry.contents.every((c, i) => c === contents[i]));
  if (found) return found.data as D | null;
  const data = filesFor<D>(files, loaded);
  known.push({ contents, data });
  return data;
}

/** Every path the overlays name. */
export function overlayFiles(overlays: readonly Overlay<unknown>[]): string[] {
  return overlays.flatMap((overlay) => filePaths(namesOf(overlay)));
}
