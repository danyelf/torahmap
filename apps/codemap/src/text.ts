// A repository's code, as one pull request left it, as a text for the app shell.

import { cameraToFit } from '@torahmap/engine';
import { TERM_SEARCH_PARAMS, type LinkKeys } from '@torahmap/link';
import type { TermSettings } from '@torahmap/search';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { createRowNumbers } from '@torahmap/shell/rowNumbers.ts';
import type { Story } from '@torahmap/stories';
import { baseColor } from './baseColor.ts';
import { BAND_GAP, FOLDER_LABEL } from './constants.ts';
import { TEXTS_FILE, structureFrom, type CodeTexts } from './data.ts';
import { codemapFiles } from './files.ts';
import { lineId } from './ids.ts';
import { computeCodeLayout, groupOf, type CodeItem } from './layout.ts';
import { CODE_OVERLAYS, codeOverlayParams } from './overlays/index.ts';
import { lineReader } from './references.ts';
import { codeSearch, configureSearch } from './search.ts';
import { codemapSite } from './site.ts';

// Shortcut: the one story is a single stop showing the whole map, until a real story is written.
const WHOLE_MAP: Story = {
  id: 'codemap',
  data: {
    title: 'The code',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: 'Every line of the repository, one bar per line.',
        camera: 'initial',
        overlay: null,
      },
    ],
  },
};

const CODE_LINK_KEYS: LinkKeys = {
  square: 'at',
  search: TERM_SEARCH_PARAMS,
  overlayParams: codeOverlayParams,
  // Low enough for a wide band of folders to fit across a phone; a link without a camera opens
  // on most of a desktop-wide band.
  zoom: { min: 0.02, max: 12, start: 0.08 },
};

/** The width in pixels of a text set at `fontSize` in the labels' font, `--text-font`. */
function textWidth(container: HTMLElement, fontSize: number): (text: string) => number {
  const context = document.createElement('canvas').getContext('2d')!;
  context.font = `${fontSize}px ${getComputedStyle(container).getPropertyValue('--text-font')}`;
  return (text) => context.measureText(text).width;
}

export const codemapText: MapText<CodeItem, TermSettings> = {
  site: codemapSite,
  link: CODE_LINK_KEYS,
  languages: [ENGLISH],
  files: codemapFiles,

  open(loaded) {
    const structure = structureFrom(loaded);
    const laid = computeCodeLayout(structure);
    const pathOf = (item: CodeItem) => structure.files[item.file].path;
    const firstFile = structure.files.find((f) => !f.deleted);

    return {
      items: laid.items,

      startCamera: (viewport) =>
        cameraToFit(
          { minX: 0, minY: 0, maxX: laid.bounds.width, maxY: laid.bounds.height },
          viewport.width,
          viewport.height,
          CODE_LINK_KEYS.zoom,
        ),

      baseColor,

      labels: (container) => {
        const width = textWidth(container, FOLDER_LABEL.fontSize);
        // A folder's name shows once it fits above the folder and in the gap between bands, so
        // it runs into neither another name nor the band above.
        const gapFits = (FOLDER_LABEL.fontSize + FOLDER_LABEL.offset) / BAND_GAP;
        return createRowNumbers(
          'codemap-folders',
          laid.books.map((b) => ({
            text: b.name,
            x: b.minX,
            y: b.minY,
            zoom: Math.max(gapFits, width(b.name) / (b.maxX - b.minX)),
          })),
          container,
          FOLDER_LABEL,
        );
      },

      popupText(item, loadedFiles) {
        const texts = loadedFiles.get(TEXTS_FILE) as CodeTexts | undefined;
        const path = pathOf(item);
        // A deleted file is not in the head, so its link is to the base.
        return {
          ref: item.deletedFile ? path : lineId(path, item.line),
          hebrew: '',
          english: texts?.[item.file]?.[item.line - 1] ?? '',
          link: item.deletedFile
            ? `${structure.repoUrl}/blob/${structure.base}/${path}`
            : `${structure.repoUrl}/blob/${structure.head}/${path}#L${item.line}`,
        };
      },

      overlays: CODE_OVERLAYS,

      search: codeSearch,

      start(shell) {
        configureSearch(laid.items, shell.pinAndGlide);
      },

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      goTo: {
        examples: firstFile ? [firstFile.path, lineId(firstFile.path, 1)] : [],
        ...lineReader(laid.items.map((item) => item.id)),
      },

      area: (item) => ({ area: pathOf(item), section: groupOf(pathOf(item)) }),
    };
  },
};
