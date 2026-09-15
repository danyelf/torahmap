// The panel that opens when a word is clicked.
//
// It names the word the reader clicked before anything happens, because a
// search replaces whatever overlay is showing and a click is too ordinary a
// gesture to do that on its own.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openWordMenu, closeWordMenu } from '../../wordMenu';
import type { Meaning } from '../../search/dictionary';

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

function anchor(): HTMLElement {
  const span = document.createElement('span');
  document.body.appendChild(span);
  return span;
}

beforeEach(() => {
  document.body.innerHTML = '';
  closeWordMenu();
});

describe('one certain meaning', () => {
  it('names the word and offers to search it', () => {
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose: vi.fn(),
    });

    const menu = document.querySelector('.word-menu')!;
    expect(menu.textContent).toContain('עָלֶה');
    expect(menu.textContent).toContain('leafage');
    expect(menu.textContent).toContain('13');
    expect(menu.querySelectorAll('.word-menu-choice')).toHaveLength(1);
  });

  it('hands back the meaning that was chosen', () => {
    const onChoose = vi.fn();
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose,
    });

    document.querySelector<HTMLElement>('.word-menu-choice')!.click();

    expect(onChoose).toHaveBeenCalledWith(leaf);
  });
});

describe('when the verse cannot choose', () => {
  it('offers each reading with no default', () => {
    openWordMenu({
      word: 'עלת',
      meanings: [leaf, ascend],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose: vi.fn(),
    });

    const choices = [...document.querySelectorAll('.word-menu-choice')];
    expect(choices).toHaveLength(2);
    expect(choices.some((c) => c.textContent?.includes('leafage'))).toBe(true);
    expect(choices.some((c) => c.textContent?.includes('ascend'))).toBe(true);
  });
});

describe('a word the dictionary does not know', () => {
  it('offers to search the spelling as written', () => {
    const onChoose = vi.fn();
    openWordMenu({
      word: 'לו',
      meanings: [],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose,
    });

    const choice = document.querySelector<HTMLElement>('.word-menu-choice')!;
    expect(choice.textContent).toContain('לו');

    choice.click();
    expect(onChoose).toHaveBeenCalledWith(null);
  });
});

describe('when searching costs the current view', () => {
  it('says which view will be lost', () => {
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: 'Haftarah',
      paletteFull: false,
      onChoose: vi.fn(),
    });

    expect(document.querySelector('.word-menu')!.textContent).toContain('Haftarah');
  });
});

describe('when the palette is full', () => {
  it('says so instead of offering a choice that would do nothing', () => {
    const onChoose = vi.fn();
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: true,
      onChoose,
    });

    const menu = document.querySelector('.word-menu')!;
    expect(menu.textContent).toContain('Five words are already on the map');
    expect(menu.querySelectorAll('.word-menu-choice')).toHaveLength(0);
  });
});

describe('dismissing', () => {
  it('leaves nothing behind and chooses nothing', () => {
    const onChoose = vi.fn();
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose,
    });

    closeWordMenu();

    expect(document.querySelector('.word-menu')).toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('replaces an open menu rather than stacking a second one', () => {
    openWordMenu({
      word: 'עלה',
      meanings: [leaf],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose: vi.fn(),
    });
    openWordMenu({
      word: 'רוח',
      meanings: [ascend],
      anchor: anchor(),
      replacesOverlay: null,
      paletteFull: false,
      onChoose: vi.fn(),
    });

    expect(document.querySelectorAll('.word-menu')).toHaveLength(1);
  });
});
