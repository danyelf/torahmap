// The colour testbed as a text for the app shell: swatches, with no words to read or search.

import { cameraToFit } from '@torahmap/engine';
import { TERM_SEARCH_PARAMS, type LinkKeys } from '@torahmap/link';
import type { GoTo, MapText } from '@torahmap/shell/app/text.ts';
import type { SearchTool } from '@torahmap/shell/app/search.ts';
import type { Story } from '@torahmap/stories';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { createMapLabels, sectionLabelReach } from '@torahmap/shell/mapLabels.ts';
import { BLOCK_TAB, PALETTE_LABEL_SIZE } from './constants.ts';
import { computeSwatchLayout, type SwatchItem } from './layout.ts';
import { swatchOverlay } from './overlay.ts';
import { BLOCK_SIZES, PALETTES } from './palettes.ts';
import { colortestbedSite } from './site.ts';

const LINK_KEYS: LinkKeys = {
  square: 'at',
  search: TERM_SEARCH_PARAMS,
  overlayParams: () => undefined,
  zoom: { min: 0.1, max: 12, start: 1 },
};

// The shell asks every text for a search; this one finds nothing.
const noSearch: SearchTool<SwatchItem> = {
  id: 'search',
  name: 'Search',
  description: 'Nothing to search here.',
  getItemColor: () => null,
  colorsFor: (items) => items.map(() => null),
  isSearching: () => false,
  telemetry: { readerChanged() {}, replaced() {}, dataLoaded() {} },
};

// The shell needs a story to open on.
const WHOLE_MAP: Story = {
  id: 'colortestbed',
  data: {
    title: 'Colour Testbed',
    description: '',
    draft: false,
    stops: [{ id: 'start', text: 'Palettes as squares.', camera: 'initial', overlay: null }],
  },
};

const noGoTo: GoTo = {
  examples: [],
  read: () => null,
  complete: () => [],
  languageOf: () => ENGLISH,
};

export const colortestbedText: MapText<SwatchItem> = {
  site: colortestbedSite,
  link: LINK_KEYS,
  languages: [ENGLISH],
  files: { first: [], popup: () => '' },

  open() {
    const laid = computeSwatchLayout(PALETTES, BLOCK_SIZES);

    return {
      items: laid.items,

      startCamera(viewport) {
        const width = laid.bounds.width + sectionLabelReach(PALETTE_LABEL_SIZE);
        const box = { minX: 0, minY: 0, maxX: width, maxY: laid.bounds.height };
        return cameraToFit(box, viewport.width, viewport.height, LINK_KEYS.zoom);
      },

      // The same colour the overlay gives, so the map reads as swatches before any overlay is chosen.
      baseColor: (item) => item.color,

      labels(container) {
        return createMapLabels(laid.books, container, {
          sectionNames: Object.fromEntries(PALETTES.map((p) => [p.name, { he: '', en: p.name }])),
          sectionSize: PALETTE_LABEL_SIZE,
          tab: BLOCK_TAB,
          direction: 'ltr',
        });
      },

      popupText: (item) => ({ ref: item.palette, hebrew: '', english: item.spec, link: '' }),

      overlays: [swatchOverlay],
      search: noSearch,
      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },
      goTo: noGoTo,
      area: (item) => ({ area: item.palette, section: item.palette }),
    };
  },
};
