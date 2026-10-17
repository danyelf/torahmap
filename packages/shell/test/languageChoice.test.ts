import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyLanguageChoice,
  bindLanguageChoice,
  languageChoiceHtml,
} from '../src/languageChoice.ts';

const hidden = () => ({
  hebrew: document.body.classList.contains('english-only'),
  english: document.body.classList.contains('hebrew-only'),
});

function control(): HTMLElement {
  document.body.insertAdjacentHTML('beforeend', languageChoiceHtml());
  const div = document.querySelector<HTMLElement>('#language-choice')!;
  bindLanguageChoice(div);
  return div;
}

const press = (div: HTMLElement, choice: string) =>
  div.querySelector<HTMLButtonElement>(`[data-languages="${choice}"]`)!.click();

const pressed = (div: HTMLElement) =>
  [...div.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]')].map(
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
    const div = control();
    press(div, 'hebrew');
    expect(hidden()).toEqual({ hebrew: false, english: true });
    expect(pressed(div)).toEqual(['hebrew']);
    press(div, 'english');
    expect(hidden()).toEqual({ hebrew: true, english: false });
    press(div, 'both');
    expect(hidden()).toEqual({ hebrew: false, english: false });
  });

  it('is remembered on the next visit', () => {
    applyLanguageChoice(true);
    press(control(), 'hebrew');
    document.body.className = '';
    applyLanguageChoice(true);
    expect(hidden()).toEqual({ hebrew: false, english: true });
  });

  it('starts a reader who had Hide Hebrew on at English only', () => {
    localStorage.setItem('torahMap.englishOnly', 'true');
    applyLanguageChoice(true);
    expect(hidden()).toEqual({ hebrew: true, english: false });
  });

  it('hides nothing on a text with one language, whatever was chosen', () => {
    localStorage.setItem('torahMap.languages', 'english');
    applyLanguageChoice(false);
    expect(hidden()).toEqual({ hebrew: false, english: false });
  });
});
