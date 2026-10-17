// The reader's choice of which languages the popup and the map labels show,
// offered by a text that has two. Search still takes both; only what is
// displayed changes.

import { CONTROL } from './panel.ts';
import { ENGLISH, HEBREW, type TextLanguage } from './language.ts';

/** One language alone, or both. */
type LanguageChoice = TextLanguage | 'both';

const STORAGE_KEY = 'torahMap.languages';

const CHOICES: readonly { choice: LanguageChoice; glyph: string; name: string }[] = [
  { choice: HEBREW, glyph: 'א', name: 'Hebrew only' },
  { choice: 'both', glyph: 'אA', name: 'Hebrew and English' },
  { choice: ENGLISH, glyph: 'A', name: 'English only' },
];

/** The body class while a language shows alone. */
const ALONE: Record<TextLanguage, string> = { [HEBREW]: 'hebrew-only', [ENGLISH]: 'english-only' };

let current: LanguageChoice = 'both';

function load(): LanguageChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CHOICES.find((c) => c.choice === saved)?.choice ?? 'both';
  } catch {
    return 'both';
  }
}

function save(choice: LanguageChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private windows can refuse storage; the choice then lasts the visit.
  }
}

function show(choice: LanguageChoice): void {
  current = choice;
  for (const language of [HEBREW, ENGLISH] as const) {
    document.body.classList.toggle(ALONE[language], language === choice);
  }
}

/** Applies the reader's stored choice to a text with two languages. Runs at startup. */
export function applyLanguageChoice(twoLanguages: boolean): void {
  show(twoLanguages ? load() : 'both');
}

export function languageChoiceHtml(): string {
  const buttons = CHOICES.map(
    ({ choice, glyph, name }) =>
      `<button type="button" class="${CONTROL.segment}" data-languages="${choice}" title="${name}">${glyph}<span class="visually-hidden"> ${name}</span></button>`,
  ).join('');
  return `<div class="setting">
    <span class="setting-label" id="language-choice-label">Text Language</span>
    <div class="${CONTROL.segments}" id="language-choice" role="group" aria-labelledby="language-choice-label">${buttons}</div>
  </div>`;
}

/** Makes the choice in `panel`, if it has one, show and change what is shown. */
export function bindLanguageChoice(panel: HTMLElement): void {
  const control = panel.querySelector('#language-choice');
  if (!control) return;
  const buttons = CHOICES.map(
    ({ choice }) =>
      [choice, control.querySelector<HTMLButtonElement>(`[data-languages="${choice}"]`)!] as const,
  );
  const mark = (): void => {
    for (const [choice, b] of buttons) {
      b.classList.toggle('on', choice === current);
      b.setAttribute('aria-pressed', String(choice === current));
    }
  };
  mark();
  for (const [choice, b] of buttons) {
    b.addEventListener('click', () => {
      show(choice);
      save(choice);
      mark();
    });
  }
}
