// What each line is: code, a comment, an import, a file header or blank.

import { swatchList } from '@torahmap/shell/overlays/swatchList.ts';
import type { Overlay } from '@torahmap/shell/overlays/types.ts';
import { colorToCss, hex, type Color } from '@torahmap/utils';
import { LINE_KINDS, type LineKind } from '../data.ts';
import type { CodeItem } from '../layout.ts';

export const KIND_COLORS: Readonly<Record<LineKind, Color>> = {
  x: hex('#9aa3ad'),
  c: hex('#6fbf73'),
  i: hex('#c586c0'),
  h: hex('#4fa3e0'),
  b: hex('#3a3f46'),
};

const KINDS = Object.keys(LINE_KINDS) as LineKind[];

export const lineKindOverlay: Overlay<CodeItem> = {
  id: 'kind',
  name: 'Line type',
  description: 'Shows what each line is: code, a comment, an import, a file header or blank.',
  colorsFor: ({ items }) => items.map((item) => KIND_COLORS[item.kind]),
  renderLegend(container) {
    container.replaceChildren(
      ...swatchList(KINDS.map((k) => ({ color: KIND_COLORS[k], name: LINE_KINDS[k] }))),
    );
  },
  summary: () => ({ groups: [KINDS.map((k) => colorToCss(KIND_COLORS[k]))] }),
};
