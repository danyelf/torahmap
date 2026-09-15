// The panel that opens when a reader clicks a word.
//
// Clicking a word never searches by itself. Search is an overlay, and
// setOverlay() destroys the outgoing one along with its settings, so a stray
// click on a verse would silently cost a reader their Haftarah view. The panel
// is where that becomes deliberate - and it doubles as the confirmation that
// we found the word the reader meant, since Hebrew words run together and a
// misfire should be visible before it costs anything.

import './styles/wordMenu.css';
import { sameMeaning, type Meaning } from './search/dictionary.ts';

export interface WordMenuOptions {
  word: string;
  /** What the verse supports: usually one, sometimes a few, sometimes none. */
  meanings: Meaning[];
  /** Every reading the spelling allows, whatever the verse says. */
  otherReadings: Meaning[];
  anchor: HTMLElement;
  replacesOverlay: string | null;
  /** True when choosing a meaning would move Hebrew search into root mode. */
  switchesToRootMode: boolean;
  paletteFull: boolean;
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

/** Search the spelling exactly as the verse writes it, meanings aside. */
function literalChoice(options: WordMenuOptions): HTMLButtonElement {
  const label = document.createElement('span');
  label.textContent = `Search ${options.word} as written`;
  return choice(label, () => {
    options.onChoose(null);
    closeWordMenu();
  });
}

/**
 * The "other readings" disclosure: a button that replaces itself with the rows
 * it stands for.
 *
 * Both branches of the panel need it, and they need it for the same reason:
 * these are readings worth offering but not worth putting first. Where the
 * verse settled the word they are the readings it ruled out; where it could not
 * they are the whole candidate list, which is usually not the word in front of
 * the reader. What differs between the branches is which choice is primary, not
 * how the rest of them are reached.
 */
function appendOtherReadings(
  menu: HTMLElement,
  readings: Meaning[],
  options: WordMenuOptions,
): void {
  if (readings.length === 0) return;

  const expandButton = document.createElement('button');
  expandButton.type = 'button';
  expandButton.className = 'word-menu-expand-other';
  expandButton.textContent = 'other readings';
  expandButton.addEventListener('click', () => {
    // The button stands in for the rows, so it gives up its place to them.
    expandButton.remove();
    for (const reading of readings) {
      menu.appendChild(
        choice(meaningLabel(reading), () => {
          options.onChoose(reading);
          closeWordMenu();
        }),
      );
    }
  });
  menu.appendChild(expandButton);
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

  // Whether a reading is on offer at all, which is what the warnings below are
  // about: nothing is at stake in a panel that only says the palette is full.
  const offersMeaning =
    !options.paletteFull && (options.meanings.length > 0 || options.otherReadings.length > 0);

  if (options.paletteFull) {
    // Five colours, five words. A sixth would repeat a colour and the map could
    // no longer say which word is which, so this says so rather than offering a
    // button that would decline.
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Five words are already on the map. Remove one to add another.';
    menu.appendChild(note);
  } else if (options.meanings.length === 0) {
    // The verse cannot say which word this is, and for nearly nine clicks in
    // ten the reason is that the true word is a function word carrying a prefix
    // or a suffix - the object marker את on its own is more than half of them.
    // The generator leaves those out of the spelling map deliberately, so the
    // candidates the spelling allows are mostly unrelated words that happen to
    // be written the same way. Searching the spelling as written is the thing
    // that actually works here, so it is the choice on offer; the minority of
    // words the candidate list does suit are one click further on.
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Not found as a dictionary word.';
    menu.appendChild(note);

    menu.appendChild(literalChoice(options));
    appendOtherReadings(menu, options.otherReadings, options);
  } else {
    if (options.meanings.length > 1) {
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

    // What the spelling allows that the verse did not already put on offer. A
    // reading counts as shown when it shares a lexeme with one above, not when
    // it shares a first key: the two lists head a merged reading differently
    // whenever the verse lacks the group's earliest member, and comparing first
    // keys would offer the reader the same reading twice under a different
    // verse count.
    appendOtherReadings(
      menu,
      options.otherReadings.filter(
        (reading) => !options.meanings.some((shown) => sameMeaning(reading, shown.keys)),
      ),
      options,
    );
  }

  if (options.replacesOverlay) {
    const warning = document.createElement('div');
    warning.className = 'word-menu-warning';
    warning.textContent = `Searching replaces the ${options.replacesOverlay} view.`;
    menu.appendChild(warning);
  }

  if (offersMeaning && options.switchesToRootMode) {
    // A meaning is not something a substring can express, so choosing one has
    // to move the Hebrew search into root mode. The reader chose the mode they
    // are in, so they are told before the click rather than after it.
    const warning = document.createElement('div');
    warning.className = 'word-menu-warning';
    warning.textContent = 'Searching a meaning switches Hebrew search to Root.';
    menu.appendChild(warning);
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
