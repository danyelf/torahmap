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
  /** Every reading the spelling allows, whatever the verse says. */
  otherReadings: Meaning[];
  anchor: HTMLElement;
  replacesOverlay: string | null;
  paletteFull: boolean;
  onChoose: (meaning: Meaning | null) => void;
}

let open: HTMLElement | null = null;
let dismiss: ((event: MouseEvent | KeyboardEvent) => void) | null = null;

export function closeWordMenu(): void {
  open?.remove();
  open = null;
  if (dismiss) {
    document.removeEventListener('mousedown', dismiss as EventListener);
    document.removeEventListener('keydown', dismiss as EventListener);
    dismiss = null;
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

function meaningLabel(meaning: Meaning): HTMLElement {
  // Make the wrapper itself a flex container so the button's flex sees three children
  // (form, gloss, count) rather than just one wrapper span. This allows gap spacing
  // and flex: 1 on gloss to work correctly.
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

  if (options.paletteFull) {
    // Five colours, five words. A sixth would repeat a colour and the map could
    // no longer say which word is which, so this says so rather than offering a
    // button that would decline.
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Five words are already on the map. Remove one to add another.';
    menu.appendChild(note);
  } else if (options.meanings.length === 0) {
    const note = document.createElement('div');
    note.className = 'word-menu-note';
    note.textContent = 'Not in the dictionary.';
    menu.appendChild(note);

    const label = document.createElement('span');
    label.textContent = `Search for ${options.word} as written`;
    menu.appendChild(
      choice(label, () => {
        options.onChoose(null);
        closeWordMenu();
      }),
    );
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

    // Find other readings not already shown.
    const shownKeys = new Set(options.meanings.map((m) => m.keys[0]));
    const extraReadings = options.otherReadings.filter((m) => !shownKeys.has(m.keys[0]));

    // Only show the expand button if there are extra readings and the palette is not full.
    if (extraReadings.length > 0) {
      const expandButton = document.createElement('button');
      expandButton.type = 'button';
      expandButton.className = 'word-menu-expand-other';
      expandButton.textContent = 'other readings';
      expandButton.addEventListener('click', () => {
        // Replace the expand button with the extra readings.
        expandButton.remove();
        for (const reading of extraReadings) {
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
  }

  if (options.replacesOverlay) {
    const warning = document.createElement('div');
    warning.className = 'word-menu-warning';
    warning.textContent = `Searching replaces the ${options.replacesOverlay} view.`;
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
}
