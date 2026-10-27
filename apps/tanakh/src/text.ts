// The Tanakh as a text for the app shell.

import { computeLayout, getLayoutBounds } from './layout.ts';
import { createMapLabels } from '@torahmap/shell/mapLabels.ts';
import { createBookCovers } from '@torahmap/shell/bookCovers.ts';
import { SECTION_NAMES, SECTION_SIZE, bookBoxes } from './labels.ts';
import { createMapTitle, updateMapTitlePosition } from './mapTitle.ts';
import { structureFrom } from './verseTexts.ts';
import { initBookData } from './books.ts';
import { getDefaultColor } from './baseColor.ts';
import { popupText } from './popup.ts';
import { EXAMPLES, verseReader } from './references.ts';
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

// The room a book's panel leaves around its squares, in map units, and how strongly it shows.
const BOOK_PADDING = 8;
const BOOK_COVER_OPACITY = 0.12;

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
    let covers: ReturnType<typeof createBookCovers> | null = null;
    let coverNames: string[] = [];

    return {
      items,

      startCamera: (viewport) => createCamera(viewport, bounds, LINK_KEYS.zoom),

      baseColor: (_, i) => getDefaultColor(i),

      labels(container) {
        const boxes = bookBoxes(items, data.books);
        const layer = document.createElement('div');
        layer.id = 'tanakh-labels';
        covers = createBookCovers(
          'tanakh-books',
          boxes.map(({ minX, maxX, minY, maxY }) => ({
            minX: minX - BOOK_PADDING,
            maxX: maxX + BOOK_PADDING,
            minY: minY - BOOK_PADDING,
            maxY: maxY + BOOK_PADDING,
          })),
          boxes.map(() => null),
          BOOK_COVER_OPACITY,
        );
        coverNames = boxes.map(({ name }) => name);
        layer.appendChild(covers.el);
        container.appendChild(layer);
        const moveNames = createMapLabels(boxes, container, {
          sectionNames: SECTION_NAMES,
          sectionSize: SECTION_SIZE,
        });
        const mapTitle = createMapTitle(items, container, (book) => sections.get(book) === 'torah');
        return (offset, zoom) => {
          layer.style.transform = `translate(${offset.x * zoom}px, ${offset.y * zoom}px)`;
          covers!.place(zoom);
          moveNames(offset, zoom);
          updateMapTitlePosition(mapTitle, offset, zoom);
        };
      },

      tintBooks(tints) {
        coverNames.forEach((name, i) => covers?.tint(i, tints?.[name] ?? null));
      },

      popupText,

      overlays: getAllOverlays(),

      search: searchTool,

      stories: {
        list: STORIES,
        resolve: (...args) => resolveStops(...args, LINK_KEYS.zoom),
      },

      goTo: { examples: EXAMPLES, ...verseReader(data.books) },

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
