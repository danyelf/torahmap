import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyLanguageChoice,
  bindLanguageChoice,
  languageChoiceHtml,
  shownLanguages,
} from '../src/languageChoice.ts';
import { ENGLISH, HEBREW } from '../src/language.ts';

const hidden = () => ({
  hebrew: document.body.classList.contains('english-only'),
  english: document.body.classList.contains('hebrew-only'),
});

function control(changed: () => void = () => {}): HTMLElement {
  const panel = document.createElement('div');
  panel.innerHTML = languageChoiceHtml();
  document.body.appendChild(panel);
  bindLanguageChoice(panel, changed);
  return panel;
}

const press = (panel: HTMLElement, choice: string) =>
  panel.querySelector<HTMLButtonElement>(`[data-languages="${choice}"]`)!.click();

const pressed = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]')].map(
    (b) => b.dataset.languages,
  );

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '';
});

const BOTH = [HEBREW, ENGLISH] as const;

describe('the language choice', () => {
  it('shows both languages by default', () => {
    applyLanguageChoice(BOTH);
    expect(hidden()).toEqual({ hebrew: false, english: false });
    expect(pressed(control())).toEqual(['both']);
  });

  it('hides the language not chosen, and marks the choice', () => {
    applyLanguageChoice(BOTH);
    const panel = control();
    press(panel, HEBREW);
    expect(hidden()).toEqual({ hebrew: false, english: true });
    expect(pressed(panel)).toEqual([HEBREW]);
    press(panel, ENGLISH);
    expect(hidden()).toEqual({ hebrew: true, english: false });
    press(panel, 'both');
    expect(hidden()).toEqual({ hebrew: false, english: false });
  });

  it('is remembered on the next visit', () => {
    applyLanguageChoice(BOTH);
    press(control(), HEBREW);
    document.body.className = '';
    applyLanguageChoice(BOTH);
    expect(hidden()).toEqual({ hebrew: false, english: true });
  });

  it('shows a text with only English in English alone, whatever was chosen', () => {
    applyLanguageChoice(BOTH);
    press(control(), HEBREW);
    applyLanguageChoice([ENGLISH]);
    expect(hidden()).toEqual({ hebrew: true, english: false });
  });

  it('shows a text with only Hebrew in Hebrew alone, whatever was chosen', () => {
    applyLanguageChoice(BOTH);
    press(control(), ENGLISH);
    applyLanguageChoice([HEBREW]);
    expect(hidden()).toEqual({ hebrew: false, english: true });
  });

  it('says which languages are shown, and when the reader changes them', () => {
    applyLanguageChoice(BOTH);
    const seen: (readonly string[])[] = [];
    const panel = control(() => seen.push(shownLanguages()));
    expect(shownLanguages()).toEqual([HEBREW, ENGLISH]);
    press(panel, HEBREW);
    press(panel, ENGLISH);
    expect(seen).toEqual([[HEBREW], [ENGLISH]]);
  });

  it('binds nothing in a panel without the choice', () => {
    expect(() => bindLanguageChoice(document.createElement('div'), () => {})).not.toThrow();
  });
});
