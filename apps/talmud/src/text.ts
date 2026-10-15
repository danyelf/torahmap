// The Babylonian Talmud as a text for the app shell.

import { cameraToFit } from '@torahmap/engine';
import { sefariaUrl } from '@torahmap/utils';
import type { MapText } from '@torahmap/shell/app/text.ts';
import type { Story } from '@torahmap/stories';
import type { LinkKeys } from '@torahmap/link';
import { commentaryLink } from '@torahmap/overlay-catalog';
import { computeTalmudLayout, talmudRef, type TalmudLayoutItem } from './layout.ts';
import { talmudSite } from './site.ts';
import { createTalmudLabels, updateTalmudLabelPositions } from './talmudLabels.ts';
import { mishnahOrGemaraColor } from './baseColor.ts';
import { TALMUD_SEARCH_PARAMS, talmudSearch, type TalmudSearchSettings } from './search.ts';
import {
  STRUCTURE_FILE,
  amudIndex,
  structureFrom,
  textsFile,
  type TalmudTractateText,
} from './data.ts';

// Shortcut: the Talmud's one story is a single stop showing the whole map, until
// its first real story is written.
const WHOLE_MAP: Story = {
  id: 'talmud',
  data: {
    title: 'The Talmud',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: 'The Babylonian Talmud, one square per segment.',
        camera: 'initial',
        overlay: null,
      },
    ],
  },
};

const TALMUD_LINK_KEYS: LinkKeys = {
  square: 'at',
  search: TALMUD_SEARCH_PARAMS,
  overlayParams: () => undefined,
  // Low enough for the whole Talmud to fit across a phone.
  zoom: { min: 0.05, max: 10, start: 1 },
};

// The commentary overlay's category for the Talmud, as public/data/overlays/commentary/ names it.
export const TALMUD_CATEGORY = 'Talmud';

export const talmudText: MapText<TalmudLayoutItem, TalmudSearchSettings> = {
  site: talmudSite,
  link: TALMUD_LINK_KEYS,
  firstFiles: [STRUCTURE_FILE],

  open(loaded) {
    const structure = structureFrom(loaded);
    const tractates = new Map(structure.tractates.map((t) => [t.name, t]));
    const laid = computeTalmudLayout(structure);

    /** A segment's text and citations in its tractate's file, which lists both by amud. */
    const segmentIn = (s: TalmudLayoutItem, file: TalmudTractateText) => {
      const first = tractates.get(s.tractate)?.amudim[0];
      const ai = first ? amudIndex(s.daf, s.amud, first) : -1;
      return {
        text: file.amudim[ai]?.[s.segment - 1] ?? '',
        citations: file.citations[ai]?.[s.segment - 1] ?? [],
      };
    };

    return {
      items: laid.items,

      startCamera: (viewport) =>
        cameraToFit(
          { minX: 0, minY: 0, maxX: laid.bounds.width, maxY: laid.bounds.height },
          viewport.width,
          viewport.height,
          TALMUD_LINK_KEYS.zoom,
        ),

      baseColor: (item) => mishnahOrGemaraColor(structure, item),

      labels(container) {
        const labels = createTalmudLabels(
          laid.tractateBlocks,
          laid.sederBlocks,
          laid.perekAnchors,
          laid.dafRows,
          container,
        );
        return (offset, zoom) => updateTalmudLabelPositions(labels, offset, zoom);
      },

      popupFile: (item) => textsFile(item.tractate),

      popupText(item, loaded) {
        const file = loaded.get(textsFile(item.tractate)) as TalmudTractateText | undefined;
        const segment = file && segmentIn(item, file);
        return {
          ref: talmudRef(item),
          hebrew: segment?.text ?? '',
          english: '',
          link: sefariaUrl(item.tractate, [`${item.daf}${item.amud}`, item.segment]),
          hebrewLinks: segment?.citations.map(({ start, end, verse }) => ({
            start,
            end,
            href: commentaryLink(verse, TALMUD_CATEGORY),
          })),
        };
      },

      overlays: [],

      search: talmudSearch,

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      area: (s) => ({ area: s.tractate, section: tractates.get(s.tractate)?.seder ?? '' }),
    };
  },
};
