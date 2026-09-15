// A few verses carrying both Hebrew and English, for tests about a search
// whose terms are not all in the same language.
import type { VerseTexts } from '../../verseTexts.ts';

export const ALL_TEXTS_FIXTURE: VerseTexts = {
  Genesis: {
    1: {
      1: {
        he: 'בראשית ברא אלהים את השמים ואת הארץ',
        en: 'When God began to create heaven and earth',
      },
      2: { he: 'ורוח אלהים מרחפת', en: 'a wind from God sweeping over the water' },
      3: { he: 'ויאמר אלהים יהי אור', en: 'God said, Let there be light' },
    },
    2: {
      4: { he: 'אלה תולדות השמים', en: 'Such is the story of heaven' },
    },
  },
};
