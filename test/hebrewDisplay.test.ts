import { afterEach, describe, expect, it } from 'vitest';
import { applyHebrewChoice } from '../packages/shell/src/hebrewDisplay.ts';

afterEach(() => {
  document.body.className = '';
  localStorage.clear();
});

describe('the Hebrew choice', () => {
  it('shows English only on a page with no Hebrew, whatever was chosen before', () => {
    localStorage.setItem('torahMap.englishOnly', 'false');
    applyHebrewChoice(false);
    expect(document.body.classList.contains('english-only')).toBe(true);
  });

  it('does not write the choice for a page with no Hebrew', () => {
    applyHebrewChoice(false);
    expect(localStorage.getItem('torahMap.englishOnly')).toBeNull();
  });

  it('follows the stored choice on a page with Hebrew', () => {
    localStorage.setItem('torahMap.englishOnly', 'true');
    applyHebrewChoice(true);
    expect(document.body.classList.contains('english-only')).toBe(true);
    localStorage.setItem('torahMap.englishOnly', 'false');
    applyHebrewChoice(true);
    expect(document.body.classList.contains('english-only')).toBe(false);
  });
});
