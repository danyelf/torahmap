// The Tanakh as a text for the app shell.

import { computeLayout, getLayoutBounds } from './layout.ts';
import { createMapLabels } from '@torahmap/shell/mapLabels.ts';
import { SECTION_NAMES, SECTION_SIZE, bookBoxes } from './labels.ts';
import { createMapTitle, updateMapTitlePosition } from './mapTitle.ts';
import { structureFrom } from './verseTexts.ts';
import { initBookData } from './books.ts';
import { getDefaultColor } from '@torahmap/shell/itemColoring.ts';
import { popupText } from './popup.ts';
import { verseReader } from './references.ts';
import { createCamera } from './camera.ts';
import { reportError } from '@torahmap/shell/analytics.ts';
import { STORIES } from '@torahmap/stories/tanakh';
import { resolveStops } from './stories.ts';
import { registerAllOverlays, getAllOverlays } from './overlays/index.ts';
import { configure as configureSearch, searchTool, type SearchSettings } from './search/index.ts';
import { listenForWordClicks } from './search/wordClicks.ts';
import type { TanakhLayout } from './types.ts';
import { tanakhFiles } from './files.ts';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { tanakhSite } from './site.ts';
import { LINK_KEYS } from '@torahmap/overlay-catalog';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';

export const tanakhText: MapText<TanakhLayout, SearchSettings> = {
  site: tanakhSite,
  link: LINK_KEYS,
  languages: [HEBREW, ENGLISH],
  files: tanakhFiles,

  open(loaded) {
    registerAllOverlays();
    const data = structureFrom(loaded);
    initBookData(data);
    const sections = new Map(data.books.map((b) => [b.name, b.section]));
    const items = computeLayout(data, (message) => reportError('layout', message));
    const bounds = getLayoutBounds(items);

    return {
      items,

      startCamera: (viewport) => createCamera(viewport, bounds, LINK_KEYS.zoom),

      baseColor: (_, i) => getDefaultColor(i),

      labels(container) {
        const moveNames = createMapLabels(bookBoxes(items, data.books), container, {
          sectionNames: SECTION_NAMES,
          sectionSize: SECTION_SIZE,
        });
        const mapTitle = createMapTitle(items, container, (book) => sections.get(book) === 'torah');
        return (offset, zoom) => {
          moveNames(offset, zoom);
          updateMapTitlePosition(mapTitle, offset, zoom);
        };
      },

      popupText,

      overlays: getAllOverlays(),

      search: searchTool,

      stories: {
        list: STORIES,
        resolve: (...args) => resolveStops(...args, LINK_KEYS.zoom),
      },

      goTo: { example: 'II Kings 17', read: verseReader(data.books) },

      area: (v) => ({ area: v.book, section: sections.get(v.book) ?? '' }),

      start(shell) {
        // Most hits are off screen, so a result travels to its verse as well as pinning it.
        configureSearch({ verses: items, callbacks: { onVerseClick: shell.pinAndGlide } });
        listenForWordClicks(shell);
        // An edited story reloads in place on the dev server, keeping the reader's scroll.
        if (import.meta.hot) {
          import.meta.hot.accept('@torahmap/stories/tanakh', (module) => {
            if (module) shell.storiesChanged(module.STORIES);
          });
        }
      },
    };
  },
};
