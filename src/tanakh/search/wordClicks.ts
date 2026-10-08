// A click on a Hebrew word in the verse popup opens its menu, which adds the
// word, or one of its meanings, to the search.

import type { Shell } from '../../app/text.ts';
import type { TanakhLayout } from '../../types.ts';
import { dataFor } from '../../dataFiles.ts';
import { stripNikkud } from '../../hebrew.ts';
import { meaningsInVerse, wordsOfVerse } from './dictionary.ts';
import { dictionaryOf } from './data.ts';
import { setWordClickHandler } from '../../sidebar.ts';
import { openWordMenu } from './wordMenu.ts';
import { trackWordMenuOpen, trackWordSearch } from '../../analytics.ts';
import { searchTool, searchForMeaning, canAddTerm, type SearchSettings } from './index.ts';

/** What the word menu reads and changes. */
export type WordClickHost = Pick<
  Shell<TanakhLayout, SearchSettings>,
  'loaded' | 'searchSettings' | 'changeSearch' | 'holdPopup'
>;

export function listenForWordClicks(host: WordClickHost): void {
  setWordClickHandler<TanakhLayout>((click) => {
    const data = dataFor(searchTool, host.loaded());
    // Without search's files there is no search to add the word to.
    if (!data) return;
    const dictionary = dictionaryOf(data);
    // As a reader would type it: the letters as printed, final forms and all.
    const word = stripNikkud(click.text);
    const meanings = meaningsInVerse(
      dictionary,
      wordsOfVerse(data.parse, click.item.id, click.hebrew),
      word,
      click.item.id,
      click.index,
    );

    const paletteFull = !canAddTerm(host.searchSettings());
    trackWordMenuOpen(click.text, click.item.id, meanings.length, paletteFull);

    openWordMenu({
      word: click.text,
      meanings,
      anchor: click.element,
      paletteFull,
      onClose: host.holdPopup(),
      onChoose: (meaning) => {
        // The menu counted the words when it opened; a keyboard reader can add one since.
        if (!canAddTerm(host.searchSettings())) return;

        trackWordSearch(
          click.text,
          meaning ? `${meaning.form} ${meaning.gloss}` : 'exact',
          click.item.id,
        );
        host.changeSearch(
          (current) =>
            searchForMeaning(dictionary, current, word, meaning?.keys ?? null) ?? current,
        );
      },
    });
  });
}
