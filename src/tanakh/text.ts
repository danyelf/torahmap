// The Tanakh as a text for the app shell.

import { computeLayout, getLayoutBounds } from '../layout.ts';
import { createBookLabels, createSectionLabels, updateLabelPositions } from '../labels.ts';
import { createMapTitle, updateMapTitlePosition } from '../mapTitle.ts';
import { STRUCTURE_FILE, TEXTS_FILE, structureFrom, textsFrom } from '../verseTexts.ts';
import { initBookData } from '../constants/books.ts';
import { createCamera } from '../camera.ts';
import { stripNikkud } from '../hebrew.ts';
import { meaningsInVerse, wordsOfVerse } from '../search/dictionary.ts';
import { dictionaryOf } from '../search/data.ts';
import { openWordMenu } from '../wordMenu.ts';
import { setWordClickHandler, updateSidebar } from '../sidebar.ts';
import { reportError, trackWordMenuOpen, trackWordSearch } from '../analytics.ts';
import { verseRef } from '@torahmap/link';
import { STORIES } from '@torahmap/stories';
import { resolveStops } from '../scrollytelling/storyPanel.ts';
import { registerAllOverlays, getAllOverlays, configureSearch } from '../overlays/index.ts';
import { searchTool, searchForMeaning, canAddTerm } from '../overlays/search/index.ts';
import { dataFor } from '../dataFiles.ts';
import type { Book, TanakhLayout } from '../types.ts';
import type { MapText, Shell } from '../app/text.ts';

registerAllOverlays();

// Set by layout(); the labels and telemetry read it.
let sections = new Map<string, Book['section']>();

/** A click on a Hebrew word in the popup opens its menu, which adds it to the search. */
function listenForWordClicks(shell: Shell<TanakhLayout>): void {
  setWordClickHandler((click) => {
    const data = dataFor(searchTool, shell.loaded());
    // Without search's files there is no search to add the word to.
    if (!data) return;
    const dictionary = dictionaryOf(data);
    // As a reader would type it: the letters as printed, final forms and all.
    const word = stripNikkud(click.text);
    const meanings = meaningsInVerse(
      dictionary,
      wordsOfVerse(data.parse, click.id, click.hebrew),
      word,
      click.id,
      click.index,
    );

    const ref = verseRef(click);
    const paletteFull = !canAddTerm(shell.searchSettings());
    trackWordMenuOpen(click.text, ref, meanings.length, paletteFull);

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      paletteFull,
      onChoose: (meaning) => {
        // The menu counted the words when it opened; a keyboard reader can add one since.
        if (!canAddTerm(shell.searchSettings())) return;

        trackWordSearch(click.text, meaning ? `${meaning.form} ${meaning.gloss}` : 'exact', ref);
        shell.changeSearch(
          (current) =>
            searchForMeaning(dictionary, current, word, meaning?.keys ?? null) ?? current,
        );
      },
    });
  });
}

export const tanakhText: MapText<TanakhLayout> = {
  firstFiles: [STRUCTURE_FILE],

  layout(loaded) {
    const data = structureFrom(loaded);
    initBookData(data);
    sections = new Map(data.books.map((b) => [b.name, b.section]));
    const items = computeLayout(data, (message) => reportError('layout', message));
    return { items, bounds: getLayoutBounds(items) };
  },

  startCamera: (viewport, bounds) => createCamera(viewport, bounds),

  labels(items, loaded, container) {
    const hebrewNames = Object.fromEntries(
      structureFrom(loaded).books.map((b) => [b.name, b.hebrewName]),
    );
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
    verse: (v) => ({ book: v.book, chapter: v.chapter, verse: v.verse }),
    area: (v) => ({ area: v.book, section: sections.get(v.book) ?? '' }),
  },

  start(shell) {
    // Most hits are off screen, so a result travels to its verse as well as pinning it.
    configureSearch({ verses: [...shell.items], callbacks: { onVerseClick: shell.pinAndGlide } });
    listenForWordClicks(shell);
    // An edited story reloads in place on the dev server, keeping the reader's scroll.
    if (import.meta.hot) {
      import.meta.hot.accept('@torahmap/stories', (module) => {
        if (module) shell.storiesChanged(module.STORIES);
      });
    }
  },
};
