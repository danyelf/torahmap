import { describe, it, expect } from 'vitest';
import {
  combineLayers,
  fillDefaultColors,
  getDefaultColor,
  toolsPicture,
} from '../../itemColoring';
import { DIMMED_GREY, SEARCH_WITH_OVERLAY } from '../../constants';
import type { Color } from '../../overlays/types';
import { createVerse, testOverlay } from '../helpers/fixtures';

const CYAN: Color = [0.1, 0.7, 0.8];
const ORANGE: Color = [1, 0.5, 0];
const RED: Color = [1, 0, 0];
const BLUE: Color = [0, 0, 1];
const DIM = SEARCH_WITH_OVERLAY.NON_MATCH_DIM;
const scaled = (c: Color, f: number): Color => [c[0] * f, c[1] * f, c[2] * f];
// What search alone has always drawn a verse it does not match as.
const ALONE = DIMMED_GREY[0];

describe('combineLayers', () => {
  describe('with no search', () => {
    it('passes the overlay through untouched, with no rings', () => {
      const overlay = [RED, null, [RED, BLUE] as Color[]];
      expect(combineLayers(3, null, overlay, getDefaultColor)).toEqual({ colors: overlay });
    });

    it('leaves every verse grey with no overlay either', () => {
      expect(combineLayers(2, null, null, getDefaultColor)).toEqual({ colors: [null, null] });
    });
  });

  describe('search alone', () => {
    it('fills a match with its search colour', () => {
      expect(combineLayers(1, [CYAN], null, getDefaultColor).colors[0]).toEqual(CYAN);
    });

    it('dims a verse it does not match to the grey search alone has always used', () => {
      expect(combineLayers(1, [null], null, getDefaultColor).colors[0]).toEqual([
        ALONE,
        ALONE,
        ALONE,
      ]);
    });

    it('draws no rings', () => {
      expect(combineLayers(1, [CYAN], null, getDefaultColor).rings).toBeUndefined();
    });
  });

  describe('search over an overlay', () => {
    it('rings a match in its search colour around the overlay colour', () => {
      const { colors, rings } = combineLayers(1, [CYAN], [RED], getDefaultColor);
      expect(colors[0]).toEqual(RED);
      expect(rings![0]).toEqual(CYAN);
    });

    it('leaves the hole grey where the overlay has no colour for the match', () => {
      const { colors, rings } = combineLayers(1, [CYAN], [null], getDefaultColor);
      expect(colors[0]).toBeNull();
      expect(rings![0]).toEqual(CYAN);
    });

    it('splits the ring of a verse several words match', () => {
      expect(combineLayers(1, [[CYAN, ORANGE]], [RED], getDefaultColor).rings![0]).toEqual([
        CYAN,
        ORANGE,
      ]);
    });

    it('dims a verse it does not match, and gives it no ring', () => {
      const { colors, rings } = combineLayers(1, [null], [RED], getDefaultColor);
      expect(colors[0]).toEqual(scaled(RED, DIM));
      expect(rings![0]).toBeNull();
    });

    it('dims each stripe of a verse the overlay splits', () => {
      expect(combineLayers(1, [null], [[RED, BLUE]], getDefaultColor).colors[0]).toEqual([
        scaled(RED, DIM),
        scaled(BLUE, DIM),
      ]);
    });

    it('dims the grey of a verse the overlay leaves uncoloured', () => {
      expect(combineLayers(1, [null], [null], getDefaultColor).colors[0]).toEqual(
        scaled(getDefaultColor(0), DIM),
      );
    });

    it("dims the text's base colour of a square the overlay leaves uncoloured", () => {
      expect(combineLayers(1, [null], [null], () => BLUE, DIM).colors[0]).toEqual(
        scaled(BLUE, DIM),
      );
    });

    it('dims every verse when the search matches nothing', () => {
      const { colors, rings } = combineLayers(2, [null, null], [RED, BLUE], getDefaultColor);
      expect(colors).toEqual([scaled(RED, DIM), scaled(BLUE, DIM)]);
      expect(rings).toEqual([null, null]);
    });
  });

  describe('with the overlay in front', () => {
    it('leaves a non-match at the overlay colour, full strength', () => {
      const { colors, rings } = combineLayers(1, [null], [RED], getDefaultColor, 1);
      expect(colors[0]).toEqual(RED);
      expect(rings![0]).toBeNull();
    });

    it('still rings a match', () => {
      const { colors, rings } = combineLayers(1, [CYAN], [RED], getDefaultColor, 1);
      expect(colors[0]).toEqual(RED);
      expect(rings![0]).toEqual(CYAN);
    });

    it('leaves the default grey undimmed where the overlay has no colour', () => {
      expect(combineLayers(1, [null], [null], getDefaultColor, 1).colors[0]).toEqual(
        getDefaultColor(0),
      );
    });
  });
});

describe('fillDefaultColors', () => {
  it('replaces a null colour with the verse default, leaving others untouched', () => {
    const picture = fillDefaultColors({ colors: [RED, null, BLUE] }, getDefaultColor);
    expect(picture.colors).toEqual([RED, getDefaultColor(1), BLUE]);
  });

  it("fills a null colour with the text's base colour when it gives one", () => {
    const picture = fillDefaultColors({ colors: [RED, null] }, () => BLUE);
    expect(picture.colors).toEqual([RED, BLUE]);
    expect(picture.uncoloured).toEqual([false, true]);
  });

  it('marks the verses it filled as uncoloured', () => {
    expect(fillDefaultColors({ colors: [RED, null] }, getDefaultColor).uncoloured).toEqual([
      false,
      true,
    ]);
  });

  it('carries growth and rings through unchanged', () => {
    const picture = fillDefaultColors(
      { colors: [null], growth: [0.5], rings: [CYAN] },
      getDefaultColor,
    );
    expect(picture.growth).toEqual([0.5]);
    expect(picture.rings).toEqual([CYAN]);
  });
});

describe('toolsPicture', () => {
  it('asks each tool for its colours and combines them, search over overlay', () => {
    const overlay = testOverlay({ id: 'o', name: 'O', getVerseColor: () => RED });
    const search = testOverlay({
      id: 's',
      name: 'S',
      getVerseColor: (v) => (v.verse === 1 ? CYAN : null),
    });
    const items = [createVerse({ verse: 1 }), createVerse({ verse: 2 })];

    const picture = toolsPicture(
      {
        overlay: { tool: overlay, settings: undefined, data: undefined },
        search: { tool: search, settings: undefined, data: undefined },
      },
      items,
      null,
      getDefaultColor,
    );

    expect(picture.colors).toEqual([RED, scaled(RED, DIM)]);
    expect(picture.rings).toEqual([CYAN, null]);
  });

  it('passes a non-match dim through to combineLayers', () => {
    const overlay = testOverlay({ id: 'o', name: 'O', getVerseColor: () => RED });
    const search = testOverlay({ id: 's', name: 'S', getVerseColor: () => null });
    const items = [createVerse({ verse: 1 })];

    const picture = toolsPicture(
      {
        overlay: { tool: overlay, settings: undefined, data: undefined },
        search: { tool: search, settings: undefined, data: undefined },
      },
      items,
      null,
      getDefaultColor,
      1,
    );

    expect(picture.colors).toEqual([RED]);
  });
});
