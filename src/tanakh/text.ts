// The Tanakh as a text for the app shell.

import { computeLayout, getLayoutBounds } from '../layout.ts';
import { createBookLabels, createSectionLabels, updateLabelPositions } from '../labels.ts';
import { createMapTitle, updateMapTitlePosition } from '../mapTitle.ts';
import { STRUCTURE_FILE, TEXTS_FILE, structureFrom, textsFrom } from '../verseTexts.ts';
import { initBookData } from '../constants/books.ts';
import { createCamera } from '../camera.ts';
import { getDefaultColor } from '../itemColoring.ts';
import { updateSidebar } from '../sidebar.ts';
import { reportError } from '../analytics.ts';
import { STORIES } from '@torahmap/stories';
import { resolveStops } from '../scrollytelling/storyPanel.ts';
import { registerAllOverlays, getAllOverlays, configureSearch } from '../overlays/index.ts';
import { searchTool } from './search/index.ts';
import { listenForWordClicks } from './search/wordClicks.ts';
import { dataFor } from '../dataFiles.ts';
import type { TanakhLayout } from '../types.ts';
import type { MapText } from '../app/text.ts';

export const tanakhText: MapText<TanakhLayout> = {
  firstFiles: [STRUCTURE_FILE],

  open(loaded) {
    registerAllOverlays();
    const data = structureFrom(loaded);
    initBookData(data);
    const sections = new Map(data.books.map((b) => [b.name, b.section]));
    const items = computeLayout(data, (message) => reportError('layout', message));
    const bounds = getLayoutBounds(items);

    return {
      items,

      startCamera: (viewport) => createCamera(viewport, bounds),

      baseColor: (_, i) => getDefaultColor(i),

      labels(container) {
        const hebrewNames = Object.fromEntries(data.books.map((b) => [b.name, b.hebrewName]));
        const bookLabels = createBookLabels(items, container, hebrewNames);
        createSectionLabels(items, bookLabels, (book) => sections.get(book) ?? 'neviim');
        const mapTitle = createMapTitle(items, container, (book) => sections.get(book) === 'torah');
        return (offset, zoom) => {
          updateLabelPositions(bookLabels, offset, zoom);
          updateMapTitlePosition(mapTitle, offset, zoom);
        };
      },

      popupFile: () => TEXTS_FILE,

      drawPopup(elements, verse, view) {
        updateSidebar(elements, verse, {
          verseTexts: textsFrom(view.loaded),
          textsNotice: view.notice,
          wordsClickable: dataFor(searchTool, view.loaded) !== null,
          overlay: view.overlay,
          search: view.search,
          pinned: view.pinned,
        });
      },

      overlays: getAllOverlays(),

      stories: { list: STORIES, resolve: resolveStops },

      track: {
        verse: (v) => v,
        area: (v) => ({ area: v.book, section: sections.get(v.book) ?? '' }),
      },

      start(shell) {
        // Most hits are off screen, so a result travels to its verse as well as pinning it.
        configureSearch({ verses: items, callbacks: { onVerseClick: shell.pinAndGlide } });
        listenForWordClicks(shell);
        // An edited story reloads in place on the dev server, keeping the reader's scroll.
        if (import.meta.hot) {
          import.meta.hot.accept('@torahmap/stories', (module) => {
            if (module) shell.storiesChanged(module.STORIES);
          });
        }
      },
    };
  },
};
