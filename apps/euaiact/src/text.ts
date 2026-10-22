// The EU AI Act as a text for the app shell.

import { cameraToFit } from '@torahmap/engine';
import type { LinkKeys } from '@torahmap/link';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { createMapLabels, sectionLabelReach } from '@torahmap/shell/mapLabels.ts';
import type { Story } from '@torahmap/stories';
import { layerColor } from './baseColor.ts';
import { createRowNumbers } from '@torahmap/shell/rowNumbers.ts';
import {
  ARTICLE_NUMBER,
  ARTICLE_NUMBER_ZOOM,
  CHAPTER_TAB,
  LAYER_LABEL_SIZE,
  LAYER_NAMES,
} from './constants.ts';
import { TEXTS_FILE, structureFrom, type ActTexts } from './data.ts';
import { actRef, sourceUrl } from './ids.ts';
import { computeActLayout, type ActItem } from './layout.ts';
import { ACT_SEARCH_PARAMS, actSearch, type ActSearchSettings } from './search.ts';
import { ACT_OVERLAYS, actOverlayParams } from './overlays/index.ts';
import { euaiactSite } from './site.ts';
import { euaiactFiles } from './files.ts';

// Shortcut: the Act's one story is a single stop showing the whole map, until its first real
// story is written.
const WHOLE_MAP: Story = {
  id: 'euaiact',
  data: {
    title: 'The AI Act',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: 'The EU AI Act, one square per paragraph.',
        camera: 'initial',
        overlay: null,
      },
    ],
  },
};

const ACT_LINK_KEYS: LinkKeys = {
  square: 'at',
  search: ACT_SEARCH_PARAMS,
  overlayParams: actOverlayParams,
  // Low enough for the whole Act to fit across a phone.
  zoom: { min: 0.1, max: 12, start: 1 },
};

export const euaiactText: MapText<ActItem, ActSearchSettings> = {
  site: euaiactSite,
  link: ACT_LINK_KEYS,
  languages: [ENGLISH],
  files: euaiactFiles,

  open(loaded) {
    const laid = computeActLayout(structureFrom(loaded));

    return {
      items: laid.items,

      startCamera(viewport) {
        // The layer labels stand to the right of the map.
        const width = laid.bounds.width + sectionLabelReach(LAYER_LABEL_SIZE);
        const box = { minX: 0, minY: 0, maxX: width, maxY: laid.bounds.height };
        return cameraToFit(box, viewport.width, viewport.height, ACT_LINK_KEYS.zoom);
      },

      baseColor: (item) => layerColor(item),

      labels(container) {
        const moveNames = createMapLabels(laid.books, container, {
          sectionNames: LAYER_NAMES,
          sectionSize: LAYER_LABEL_SIZE,
          tab: CHAPTER_TAB,
          direction: 'ltr',
        });
        const moveNumbers = createRowNumbers(
          'act-article-numbers',
          laid.articles.map((a) => ({
            text: `Article ${a.number}`,
            x: a.x,
            y: a.y,
            zoom: ARTICLE_NUMBER_ZOOM,
          })),
          container,
          ARTICLE_NUMBER,
        );
        return (offset, zoom) => {
          moveNames(offset, zoom);
          moveNumbers(offset, zoom);
        };
      },

      popupText(item, loadedFiles) {
        const texts = loadedFiles.get(TEXTS_FILE) as ActTexts | undefined;
        return {
          ref: actRef(item.id),
          hebrew: '',
          english: texts?.[item.id] ?? '',
          link: sourceUrl(item.id),
        };
      },

      overlays: ACT_OVERLAYS,

      search: actSearch,

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      area: (item) => ({
        area: item.layer === 'article' ? `Chapter ${item.chapter}` : actRef(item.id),
        section: item.layer,
      }),
    };
  },
};
