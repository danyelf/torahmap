// The panel that opens when a reader clicks a word.
//
// Clicking a word never searches by itself. Search is an overlay, and
// setOverlay() destroys the outgoing one along with its settings, so a stray
// click on a verse would silently cost a reader their Haftarah view. The panel
// is where that becomes deliberate - and it doubles as the confirmation that
// we found the word the reader meant, since Hebrew words run together and a
// misfire should be visible before it costs anything.

import './styles/wordMenu.css';
import type { Meaning } from './search/dictionary.ts';

export interface WordMenuOptions {
  word: string;
  /** What the verse supports: usually one, sometimes a few, sometimes none. */
  meanings: Meaning[];
  anchor: HTMLElement;
  paletteFull: boolean;
  /** A reading of the word, or null for the written form itself. */
  onChoose: (meaning: Meaning | null) => void;
}

let open: HTMLElement | null = null;
let dismiss: ((event: MouseEvent | KeyboardEvent) => void) | null = null;
let goStale: (() => void) | null = null;

export function closeWordMenu(): void {
  open?.remove();
  open = null;
  if (dismiss) {
    document.removeEventListener('mousedown', dismiss as EventListener);
    document.removeEventListener('keydown', dismiss as EventListener);
    dismiss = null;
  }
  if (goStale) {
    window.removeEventListener('popstate', goStale);
    window.removeEventListener('resize', goStale);
    goStale = null;
  }
}

function choice(label: HTMLElement, onPick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'word-menu-choice';
  button.appendChild(label);
  button.addEventListener('click', onPick);
  return button;
}

/**
 * Search this written form and no other, with the dictionary left out of it.
 *
 * Every panel offers this, because it is what a reader does when the reading we
 * named is not the word they meant. The word is shown exactly as the verse
 * writes it, points and all, since that is what is being searched for.
 */
function exactChoice(options: WordMenuOptions): HTMLButtonElement {
  const label = document.createElement('span');
  label.textContent = `Search ${options.word} exactly`;
  return choice(label, () => {
    options.onChoose(null);
    closeWordMenu();
  });
}

function meaningLabel(meaning: Meaning): HTMLElement {
  // The dictionary form, the gloss and the verse count are three separate
  // spans, and the wrapper holding them is a flex container of its own, so that
  // the gloss can take the slack between the form and the count. Putting all
  // three in one span would let the count drift away from the right edge and
  // stop the readings from lining up down the panel.
  const label = document.createElement('span');
  label.className = 'word-menu-label';

  const form = document.createElement('span');
  form.className = 'word-menu-form';
  form.textContent = meaning.form;

  const gloss = document.createElement('span');
  gloss.className = 'word-menu-gloss';
  gloss.textContent = meaning.gloss;

  const count = document.createElement('span');
  count.className = 'word-menu-count';
  const verseSuffix = meaning.verseCount === 1 ? 'verse' : 'verses';
  count.textContent = `${meaning.verseCount} ${verseSuffix}`;

  label.append(form, gloss, count);
  return label;
}

export function openWordMenu(options: WordMenuOptions): void {
  closeWordMenu();

  const menu = document.createElement('div');
  menu.className = 'word-menu';
  menu.setAttribute('role', 'dialog');

  // What the panel is, said once and always. It names the thing the reader has
  // opened rather than reporting on their situation, so nothing it says depends
  // on what the verse turned out to hold.
  const title = document.createElement('div');
  title.className = 'word-menu-title';
  title.textContent = 'Word Search';
  menu.appendChild(title);

  if (options.paletteFull) {
    // MAX_TERMS colours are already in use; say so rather than offering a
    // button that would decline.
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Five words are already on the map. Remove one to add another.';
    menu.appendChild(note);
  } else {
    if (options.meanings.length === 0) {
      const note = document.createElement('div');
      note.className = 'word-menu-note';
      note.textContent = 'Not found as a dictionary word.';
      menu.appendChild(note);
    } else if (options.meanings.length > 1) {
      // Not a list of words that happen to share a spelling: the verse really
      // does contain both, as Genesis 8:20 contains the burnt-offering and the
      // verb. That is the word's own ambiguity, so it is offered without a
      // default rather than resolved on the reader's behalf.
      const note = document.createElement('div');
      note.className = 'word-menu-note';
      note.textContent = 'This verse carries more than one of these.';
      menu.appendChild(note);
    }

    for (const meaning of options.meanings) {
      menu.appendChild(
        choice(meaningLabel(meaning), () => {
          options.onChoose(meaning);
          closeWordMenu();
        }),
      );
    }

    menu.appendChild(exactChoice(options));
  }

  // Anchored to the word, then nudged back inside the viewport.
  const box = options.anchor.getBoundingClientRect();
  menu.style.top = `${box.bottom + 6}px`;
  menu.style.left = `${box.left}px`;

  document.body.appendChild(menu);
  open = menu;

  const width = menu.getBoundingClientRect().width;
  if (box.left + width > window.innerWidth - 8) {
    menu.style.left = `${Math.max(8, window.innerWidth - width - 8)}px`;
  }

  // A menu that cannot be dismissed is worse than no menu: the reader who did
  // not mean to click has to be able to get back to exactly where they were.
  dismiss = (event) => {
    if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
    if (event instanceof MouseEvent && menu.contains(event.target as Node)) return;
    closeWordMenu();
  };
  document.addEventListener('mousedown', dismiss as EventListener);
  document.addEventListener('keydown', dismiss as EventListener);

  // The panel names one word of one verse and sits at pixel coordinates taken
  // when it opened. Going Back can put a different verse in the popup, and a
  // resize moves the word out from under it; in both cases what is left
  // describes something that is no longer on screen, and choosing from it still
  // adds a term. So it goes away instead.
  goStale = () => closeWordMenu();
  window.addEventListener('popstate', goStale);
  window.addEventListener('resize', goStale);
}
