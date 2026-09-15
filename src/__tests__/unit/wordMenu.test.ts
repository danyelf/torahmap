// The panel that opens when a word is clicked.
//
// It names the word the reader clicked before anything happens, because a
// search replaces whatever overlay is showing and a click is too ordinary a
// gesture to do that on its own.
//
// Every panel offers two kinds of search: the reading or readings the verse
// supports, and the written form itself. It never offers a different word - the
// readings a spelling allows but this verse rules out are somebody else's word,
// and a search box that walks the reader towards one is the thing this project
// decided not to build.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openWordMenu, closeWordMenu, type WordMenuOptions } from '../../wordMenu';
import type { Meaning } from '../../search/dictionary.ts';

const leaf: Meaning = {
  keys: ['<LH=/@heb'],
  form: 'עָלֶה',
  gloss: 'leafage',
  pos: 'subs',
  language: 'heb',
  verseCount: 13,
};

const ascend: Meaning = {
  keys: ['<LH[@heb'],
  form: 'עלה',
  gloss: 'ascend',
  pos: 'verb',
  language: 'heb',
  verseCount: 818,
};

const rare: Meaning = {
  keys: ['@UNIQUE@heb'],
  form: 'נָדִיר',
  gloss: 'rare word',
  pos: 'adj',
  language: 'heb',
  verseCount: 1,
};

function anchor(): HTMLElement {
  const span = document.createElement('span');
  document.body.appendChild(span);
  return span;
}

/** A panel with nothing unusual about it, so each test states only its point. */
function open(overrides: Partial<WordMenuOptions> = {}): void {
  openWordMenu({
    word: 'עלה',
    meanings: [leaf],
    anchor: anchor(),
    replacesOverlay: null,
    switchesToRootMode: false,
    switchesToWordMode: false,
    paletteFull: false,
    onChoose: vi.fn(),
    ...overrides,
  });
}

const choices = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('.word-menu-choice'),
];
const menuText = (): string => document.querySelector('.word-menu')!.textContent ?? '';

beforeEach(() => {
  document.body.innerHTML = '';
  closeWordMenu();
});

describe('one reading, settled by the verse', () => {
  it('names the word and offers to search it', () => {
    open({ meanings: [leaf] });

    expect(menuText()).toContain('עָלֶה');
    expect(menuText()).toContain('leafage');
    expect(menuText()).toContain('13');
  });

  it('hands back the meaning that was chosen', () => {
    const onChoose = vi.fn();
    open({ meanings: [leaf], onChoose });

    choices()[0].click();

    expect(onChoose).toHaveBeenCalledWith(leaf);
  });

  it('shows correct singular verse count', () => {
    open({ word: 'נדיר', meanings: [rare] });

    expect(menuText()).toContain('1 verse');
    expect(menuText()).not.toContain('1 verses');
  });
});

describe('more than one reading, all of them in the verse', () => {
  // Genesis 8:20 really does carry both the burnt-offering and the verb. That
  // is the word's own ambiguity, not two unrelated words sharing a spelling,
  // so both are offered and neither is picked for the reader.
  it('offers each reading with no default', () => {
    open({ word: 'עלת', meanings: [leaf, ascend] });

    const meaningChoices = choices().filter((c) => !c.textContent?.includes('exactly'));
    expect(meaningChoices).toHaveLength(2);
    expect(meaningChoices.some((c) => c.textContent?.includes('leafage'))).toBe(true);
    expect(meaningChoices.some((c) => c.textContent?.includes('ascend'))).toBe(true);
  });

  it('says the verse carries more than one', () => {
    open({ word: 'עלת', meanings: [leaf, ascend] });

    expect(menuText()).toContain('This verse carries more than one of these.');
  });

  it('hands back whichever reading was chosen', () => {
    const onChoose = vi.fn();
    open({ word: 'עלת', meanings: [leaf, ascend], onChoose });

    choices()
      .find((c) => c.textContent?.includes('ascend'))!
      .click();

    expect(onChoose).toHaveBeenCalledWith(ascend);
  });
});

describe('nothing the verse can settle', () => {
  it('says so, and offers only the written form', () => {
    open({ word: 'אתו', meanings: [] });

    expect(menuText()).toContain('Not found as a dictionary word.');
    expect(choices()).toHaveLength(1);
    expect(choices()[0].textContent).toContain('אתו');
  });
});

describe('searching the written form', () => {
  // The escape hatch, in every shape of the panel: if the reading we named is
  // not the word the reader meant, the spelling itself always is.
  it('is offered alongside a settled reading', () => {
    open({ meanings: [leaf] });

    expect(choices().some((c) => c.textContent === 'Search עלה exactly')).toBe(true);
  });

  it('is offered alongside several readings', () => {
    open({ word: 'עלת', meanings: [leaf, ascend] });

    expect(choices().some((c) => c.textContent === 'Search עלת exactly')).toBe(true);
  });

  it('is offered when the verse settles nothing', () => {
    open({ word: 'אתו', meanings: [] });

    expect(choices().some((c) => c.textContent === 'Search אתו exactly')).toBe(true);
  });

  it('names the word as the verse writes it, points and all', () => {
    open({ word: 'בְּרֵאשִׁ֖ית', meanings: [] });

    expect(choices()[0].textContent).toBe('Search בְּרֵאשִׁ֖ית exactly');
  });

  it('hands back no meaning, which is what makes the search exact', () => {
    const onChoose = vi.fn();
    open({ meanings: [leaf], onChoose });

    choices()
      .find((c) => c.textContent?.includes('exactly'))!
      .click();

    expect(onChoose).toHaveBeenCalledWith(null);
  });
});

describe('when searching costs the current view', () => {
  it('says which view will be lost', () => {
    open({ replacesOverlay: 'Haftarah' });

    expect(menuText()).toContain('Haftarah');
  });
});

describe('when searching costs the current Hebrew mode', () => {
  it('says a meaning will move the search to root', () => {
    open({ meanings: [leaf], switchesToRootMode: true });

    expect(menuText()).toContain('switches Hebrew search to Root');
  });

  it('says nothing about root when the search is already there', () => {
    open({ meanings: [leaf], switchesToRootMode: false });

    expect(menuText()).not.toContain('switches Hebrew search to Root');
  });

  it('says nothing about root when no reading is on offer', () => {
    open({ meanings: [], switchesToRootMode: true });

    expect(menuText()).not.toContain('switches Hebrew search to Root');
  });

  it('says the written form will move the search to whole word', () => {
    open({ switchesToWordMode: true });

    expect(menuText()).toContain('switches Hebrew search to Whole word');
  });

  it('says nothing about whole word when the search is already there', () => {
    open({ switchesToWordMode: false });

    expect(menuText()).not.toContain('switches Hebrew search to Whole word');
  });
});

describe('layout', () => {
  it('separates form, gloss and count into distinct flex items', () => {
    open({ meanings: [leaf] });

    const label = choices()[0].querySelector('.word-menu-label')!;

    const children = [...label.children];
    expect(children).toHaveLength(3);
    expect(children[0].className).toContain('word-menu-form');
    expect(children[1].className).toContain('word-menu-gloss');
    expect(children[2].className).toContain('word-menu-count');

    expect(children[0].textContent).toBe('עָלֶה');
    expect(children[1].textContent).toBe('leafage');
    expect(children[2].textContent).toContain('13');
  });
});

describe('when the palette is full', () => {
  it('says so instead of offering a choice that would do nothing', () => {
    open({ paletteFull: true });

    expect(menuText()).toContain('Five words are already on the map');
    expect(choices()).toHaveLength(0);
  });

  it('does not offer the written form either, since it would be refused too', () => {
    open({ paletteFull: true, switchesToWordMode: true });

    expect(menuText()).not.toContain('exactly');
    expect(menuText()).not.toContain('switches Hebrew search');
  });
});

describe('dismissing', () => {
  it('leaves nothing behind and chooses nothing', () => {
    const onChoose = vi.fn();
    open({ onChoose });

    closeWordMenu();

    expect(document.querySelector('.word-menu')).toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('closes when the page navigates, so it cannot describe a verse that has gone', () => {
    open();

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(document.querySelector('.word-menu')).toBeNull();
  });

  it('closes when the window is resized, since it is positioned in fixed pixels', () => {
    open();

    window.dispatchEvent(new Event('resize'));

    expect(document.querySelector('.word-menu')).toBeNull();
  });

  it('replaces an open menu rather than stacking a second one', () => {
    open({ word: 'עלה' });
    open({ word: 'רוח', meanings: [ascend] });

    expect(document.querySelectorAll('.word-menu')).toHaveLength(1);
  });
});
