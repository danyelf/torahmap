import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyLanguageChoice,
  bindLanguageChoice,
  languageChoiceHtml,
} from '../src/languageChoice.ts';
import { ENGLISH, HEBREW } from '../src/language.ts';

const hidden = () => ({
  hebrew: document.body.classList.contains('english-only'),
  english: document.body.classList.contains('hebrew-only'),
});

function control(): HTMLElement {
  const panel = document.createElement('div');
  panel.innerHTML = languageChoiceHtml();
  document.body.appendChild(panel);
  bindLanguageChoice(panel);
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

describe('the language choice', () => {
  it('shows both languages by default', () => {
    applyLanguageChoice(true);
    expect(hidden()).toEqual({ hebrew: false, english: false });
    expect(pressed(control())).toEqual(['both']);
  });

  it('hides the language not chosen, and marks the choice', () => {
    applyLanguageChoice(true);
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
    applyLanguageChoice(true);
    press(control(), HEBREW);
    document.body.className = '';
    applyLanguageChoice(true);
    expect(hidden()).toEqual({ hebrew: false, english: true });
  });

  it('hides nothing on a text with one language, whatever was chosen', () => {
    applyLanguageChoice(true);
    press(control(), ENGLISH);
    applyLanguageChoice(false);
    expect(hidden()).toEqual({ hebrew: false, english: false });
  });

  it('binds nothing in a panel without the choice', () => {
    expect(() => bindLanguageChoice(document.createElement('div'))).not.toThrow();
  });
});
