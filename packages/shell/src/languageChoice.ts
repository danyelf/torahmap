// The reader's choice of which languages the popup and the map labels show,
// offered by a text that has two. Search still takes both; only what is
// displayed changes.

import { CONTROL } from './panel.ts';

export type LanguageChoice = 'hebrew' | 'both' | 'english';

const STORAGE_KEY = 'torahMap.languages';
/** The earlier Hide Hebrew setting: a reader who had it on starts on English only. */
const HIDE_HEBREW_KEY = 'torahMap.englishOnly';

const CHOICES: readonly { choice: LanguageChoice; glyph: string; name: string }[] = [
  { choice: 'hebrew', glyph: 'א', name: 'Hebrew only' },
  { choice: 'both', glyph: 'אA', name: 'Hebrew and English' },
  { choice: 'english', glyph: 'A', name: 'English only' },
];

/** The body class of each choice that hides a language. */
const HIDING = { hebrew: 'hebrew-only', english: 'english-only' } as const;

function isChoice(value: string | null): value is LanguageChoice {
  return CHOICES.some((c) => c.choice === value);
}

function load(): LanguageChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isChoice(saved)) return saved;
    return localStorage.getItem(HIDE_HEBREW_KEY) === 'true' ? 'english' : 'both';
  } catch {
    return 'both';
  }
}

function save(choice: LanguageChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
    localStorage.removeItem(HIDE_HEBREW_KEY);
  } catch {
    // Private windows can refuse storage; the choice then lasts the visit.
  }
}

function show(choice: LanguageChoice): void {
  for (const [c, cls] of Object.entries(HIDING)) document.body.classList.toggle(cls, c === choice);
}

function shown(): LanguageChoice {
  for (const [c, cls] of Object.entries(HIDING)) {
    if (document.body.classList.contains(cls)) return c as LanguageChoice;
  }
  return 'both';
}

/** Applies the reader's stored choice to a text with two languages. Runs at startup. */
export function applyLanguageChoice(twoLanguages: boolean): void {
  show(twoLanguages ? load() : 'both');
}

export function languageChoiceHtml(): string {
  const buttons = CHOICES.map(
    ({ choice, glyph, name }) =>
      `<button type="button" class="${CONTROL.segment}" data-languages="${choice}" aria-label="${name}" title="${name}">${glyph}</button>`,
  ).join('');
  return `<div class="setting">
    <span class="setting-label" id="language-choice-label">Text Language</span>
    <div class="${CONTROL.segments}" id="language-choice" role="group" aria-labelledby="language-choice-label">${buttons}</div>
  </div>`;
}

/** Makes the buttons languageChoiceHtml drew show and change the choice. */
export function bindLanguageChoice(control: HTMLElement): void {
  const buttons = [...control.querySelectorAll<HTMLButtonElement>('[data-languages]')];
  const mark = (): void => {
    for (const b of buttons) {
      const on = b.dataset.languages === shown();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  };
  mark();
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const choice = b.dataset.languages as LanguageChoice;
      show(choice);
      save(choice);
      mark();
    });
  }
}
