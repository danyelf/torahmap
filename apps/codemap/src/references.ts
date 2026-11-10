// Reads a reference to a line or a file: "src/main.ts:12" or "src/main.ts".

import type { GoTo } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { parseLineId } from './ids.ts';

/** Reads a reference to the lines `ids` name, in their order. */
export function lineReader(ids: readonly string[]): Omit<GoTo, 'examples'> {
  const byPath = new Map<string, string[]>();
  for (const id of ids) {
    const { path } = parseLineId(id);
    const file = byPath.get(path);
    if (file) file.push(id);
    else byPath.set(path, [id]);
  }
  const paths = [...byPath.keys()];
  const lines = new Set(ids);

  return {
    read(typed) {
      const text = typed.trim();
      const file = byPath.get(text);
      if (file) return { ref: text, ids: file };
      return lines.has(text) ? { ref: text, ids: [text] } : null;
    },
    complete(typed) {
      const text = typed.trim();
      if (!text) return [];
      return paths.filter(
        (path) => path !== text && (path.startsWith(text) || path.includes(`/${text}`)),
      );
    },
    languageOf: () => ENGLISH,
  };
}
