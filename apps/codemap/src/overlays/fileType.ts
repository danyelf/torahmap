// What kind of file each line is in, by the file's ending.

import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, hex, memoByValue, type Color } from '@torahmap/utils';
import { STRUCTURE_DATA, type CodeStructure, type StructureData } from '../data.ts';
import type { CodeItem } from '../layout.ts';

// Every pair of these is distinct on the dark map, also for colour-blind readers; the last is
// everything the others leave.
export const FILE_KINDS: readonly { name: string; color: Color; endings: readonly string[] }[] = [
  { name: 'Code', color: hex('#3987e5'), endings: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'] },
  { name: 'Prose', color: hex('#d95926'), endings: ['md', 'txt'] },
  { name: 'Scripts', color: hex('#199e70'), endings: ['sh', 'py'] },
  { name: 'Styles and pages', color: hex('#f0e0b0'), endings: ['css', 'html', 'svg'] },
  { name: 'Data and settings', color: hex('#6b7280'), endings: [] },
];
const SCRIPTS = FILE_KINDS.findIndex((k) => k.name === 'Scripts');

/** The index in FILE_KINDS of the kind of file at `path`. */
export function fileKindOf(path: string): number {
  const parts = path.split('/');
  const name = parts.at(-1)!;
  const dot = name.lastIndexOf('.');
  // A git hook has no ending.
  if (dot <= 0) return parts.includes('.githooks') ? SCRIPTS : FILE_KINDS.length - 1;
  const ending = name.slice(dot + 1);
  const kind = FILE_KINDS.findIndex((k) => k.endings.includes(ending));
  return kind < 0 ? FILE_KINDS.length - 1 : kind;
}

const kindsOf = memoByValue((structure: CodeStructure) =>
  structure.files.map((f) => fileKindOf(f.path)),
);

export const fileTypeOverlay: Overlay<CodeItem, undefined, StructureData> = {
  id: 'file',
  name: 'File type',
  description:
    'Shows what kind of file each line is in: code, prose, scripts, styles and pages, or data and settings.',
  data: STRUCTURE_DATA,
  colorsFor: ({ items, data: { structure } }) => {
    const kinds = kindsOf(structure);
    return items.map((item) => FILE_KINDS[kinds[item.file]].color);
  },
  renderLegend(container) {
    container.replaceChildren(...swatchList(FILE_KINDS));
  },
  summary: () => ({ groups: [FILE_KINDS.map((k) => colorToCss(k.color))] }),
};
