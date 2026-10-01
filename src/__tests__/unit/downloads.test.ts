import { describe, it, expect } from 'vitest';
import {
  downloadStages,
  filesFirst,
  staleAfterLanding,
  waitingOn,
  type Downloads,
  type LandingView,
} from '../../downloads';
import type { Loaded } from '../../dataFiles';
import type { Overlay } from '../../overlays/types';
import { commentaryOverlay } from '../../overlays/commentary';
import { tropOverlay } from '../../overlays/trop';
import { HAFTARAH_FILES } from '../../overlays/haftarah/readings';
import { searchTool } from '../../overlays/search/index';
import { DICTIONARY_FILES, SEARCH_FILES } from '../../search/data';
import { STRUCTURE_FILE, TEXTS_FILE } from '../../verseTexts';
import { SAMPLE_LOADED, SAMPLE_STRUCTURE } from '../helpers/fixtures';

const COUNTS = commentaryOverlay.data.counts;
const HAFTARAH = HAFTARAH_FILES.mappings;
const LEXICON = DICTIONARY_FILES.lexicon;
const PARSE = SEARCH_FILES.parse.optional;

const without = (...paths: string[]): Loaded =>
  new Map([...SAMPLE_LOADED].filter(([path]) => !paths.includes(path)));
const explore = (map: Overlay[], panel: Overlay | null, popup: boolean): LandingView => ({
  source: 'overlay',
  map,
  panel,
  popup,
});
const NOTHING = {
  map: null,
  overlayPanel: false,
  searchPanel: false,
  searchResults: false,
  popup: false,
};

describe('filesFirst', () => {
  it('names the files of the tools the opening view shows', () => {
    expect(filesFirst({ tools: [commentaryOverlay], verse: false })).toEqual([COUNTS]);
  });

  it('names the files search requires, and not the per-word parse', () => {
    const files = filesFirst({ tools: [searchTool], verse: false });
    expect(files).toEqual(expect.arrayContaining([TEXTS_FILE, LEXICON]));
    expect(files).not.toContain(PARSE);
  });

  it('names the texts for a pinned verse', () => {
    expect(filesFirst({ tools: [], verse: true })).toEqual([TEXTS_FILE]);
  });

  it('names nothing for a view with no tool and no verse', () => {
    expect(filesFirst({ tools: [], verse: false })).toEqual([]);
  });
});

describe('downloadStages', () => {
  const structureOnly: Loaded = new Map([[STRUCTURE_FILE, SAMPLE_STRUCTURE]]);

  it('downloads the opening view first, then every other required file, then the optional ones', () => {
    const stages = downloadStages([COUNTS], [searchTool, commentaryOverlay], structureOnly);
    expect(stages[0]).toEqual([COUNTS]);
    expect(stages[1]).toEqual(expect.arrayContaining([TEXTS_FILE, LEXICON]));
    expect(stages[1]).not.toContain(COUNTS);
    expect(stages[1]).not.toContain(STRUCTURE_FILE);
    expect(stages[2]).toEqual([PARSE]);
    expect(stages).toHaveLength(3);
  });

  it('goes straight to the other files when the opening view needs none', () => {
    expect(downloadStages([], [commentaryOverlay], structureOnly)).toEqual([[COUNTS]]);
  });

  it('downloads a file several tools name once, in the first stage that names it', () => {
    const stages = downloadStages([TEXTS_FILE], [searchTool, tropOverlay], structureOnly);
    expect(stages[0]).toEqual([TEXTS_FILE]);
    expect(stages.flat().filter((path) => path === TEXTS_FILE)).toHaveLength(1);
  });
});

describe('waitingOn', () => {
  const downloads = (d: Partial<Downloads>): Downloads => ({
    pending: new Set(),
    failed: new Set(),
    closed: new Set(),
    ...d,
  });

  it('says loading while a file is on its way', () => {
    expect(waitingOn(['a', 'b'], downloads({ pending: new Set(['b']) }))).toBe('loading');
  });

  it('says failed once a file has failed, even with another still on its way', () => {
    expect(
      waitingOn(['a', 'b'], downloads({ pending: new Set(['b']), failed: new Set(['a']) })),
    ).toBe('failed');
  });

  it('says nothing once the reader has closed the warning, whatever is still on its way', () => {
    expect(
      waitingOn(
        ['a', 'b'],
        downloads({ pending: new Set(['b']), failed: new Set(['a']), closed: new Set(['a']) }),
      ),
    ).toBeNull();
  });

  it('still says failed while one failed file has its warning open', () => {
    expect(
      waitingOn(['a', 'b'], downloads({ failed: new Set(['a', 'b']), closed: new Set(['a']) })),
    ).toBe('failed');
  });

  it('says nothing once every file has landed', () => {
    expect(waitingOn(['a'], downloads({}))).toBeNull();
  });
});

describe('staleAfterLanding', () => {
  it('puts nothing out of date when no tool shown reads the file', () => {
    expect(
      staleAfterLanding(
        without(HAFTARAH),
        SAMPLE_LOADED,
        explore([commentaryOverlay], commentaryOverlay, true),
      ),
    ).toEqual(NOTHING);
  });

  it('redraws the map and the popup when the texts land with trop on', () => {
    expect(
      staleAfterLanding(
        without(TEXTS_FILE),
        SAMPLE_LOADED,
        explore([tropOverlay], tropOverlay, true),
      ),
    ).toMatchObject({ map: 'overlay', overlayPanel: true, popup: true });
  });

  it('requotes the search results and redraws the popup when the per-word parse lands, and no panel', () => {
    const withParse = new Map(SAMPLE_LOADED).set(PARSE, { realigned: {}, verses: {} });
    expect(staleAfterLanding(SAMPLE_LOADED, withParse, explore([searchTool], null, true))).toEqual({
      ...NOTHING,
      searchResults: true,
      popup: true,
    });
  });

  it('requotes nothing when the per-word parse lands before the rest of search', () => {
    const before = without(LEXICON);
    const after = new Map(before).set(PARSE, { realigned: {}, verses: {} });
    expect(staleAfterLanding(before, after, explore([searchTool], null, true))).toEqual(NOTHING);
  });

  it('fades the blend when the overlay of a stop the story is between lands', () => {
    const view: LandingView = {
      source: 'blend',
      map: [commentaryOverlay],
      panel: null,
      popup: false,
    };
    expect(staleAfterLanding(without(COUNTS), SAMPLE_LOADED, view).map).toBe('blend');
  });

  it('re-aims the ease when the overlay of the stop it eases to lands', () => {
    const view: LandingView = {
      source: 'ease',
      map: [commentaryOverlay],
      panel: null,
      popup: false,
    };
    expect(staleAfterLanding(without(COUNTS), SAMPLE_LOADED, view).map).toBe('ease');
  });

  it('redraws nothing for a file that leaves its tool waiting on another', () => {
    expect(
      staleAfterLanding(
        without(TEXTS_FILE, LEXICON),
        without(LEXICON),
        explore([searchTool], null, false),
      ),
    ).toEqual(NOTHING);
  });

  it("redraws the picked overlay's panel when its file lands, and not a closed popup", () => {
    expect(
      staleAfterLanding(
        without(COUNTS),
        SAMPLE_LOADED,
        explore([commentaryOverlay], commentaryOverlay, false),
      ),
    ).toEqual({ ...NOTHING, map: 'overlay', overlayPanel: true });
  });

  it('redraws the search panel and the open popup when the dictionary lands, with no search on', () => {
    expect(staleAfterLanding(without(LEXICON), SAMPLE_LOADED, explore([], null, true))).toEqual({
      ...NOTHING,
      searchPanel: true,
      popup: true,
    });
  });
});
