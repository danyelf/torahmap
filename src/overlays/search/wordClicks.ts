// A click on a Hebrew word in the verse popup opens its menu, which adds the
// word, or one of its meanings, to the search.

import type { Loaded } from '../../dataFiles.ts';
import { dataFor } from '../../dataFiles.ts';
import { stripNikkud } from '../../hebrew.ts';
import { meaningsInVerse, wordsOfVerse } from '../../search/dictionary.ts';
import { dictionaryOf } from '../../search/data.ts';
import { setWordClickHandler } from '../../sidebar.ts';
import { openWordMenu } from '../../wordMenu.ts';
import { trackWordMenuOpen, trackWordSearch } from '../../analytics.ts';
import { verseRef } from '@torahmap/link';
import { searchTool, searchForMeaning, canAddTerm, type SearchSettings } from './index.ts';

/** What the word menu reads and changes. */
export interface WordClickHost {
  loaded(): Loaded;
  searchSettings(): SearchSettings;
  /** Change the search as the reader did, and open its panel. */
  changeSearch(update: (current: SearchSettings) => SearchSettings): void;
}

export function listenForWordClicks(host: WordClickHost): void {
  setWordClickHandler((click) => {
    const data = dataFor(searchTool, host.loaded());
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
    const paletteFull = !canAddTerm(host.searchSettings());
    trackWordMenuOpen(click.text, ref, meanings.length, paletteFull);

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      paletteFull,
      onChoose: (meaning) => {
        // The menu counted the words when it opened; a keyboard reader can add one since.
        if (!canAddTerm(host.searchSettings())) return;

        trackWordSearch(click.text, meaning ? `${meaning.form} ${meaning.gloss}` : 'exact', ref);
        host.changeSearch(
          (current) =>
            searchForMeaning(dictionary, current, word, meaning?.keys ?? null) ?? current,
        );
      },
    });
  });
}
