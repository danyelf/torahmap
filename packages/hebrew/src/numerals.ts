// Numbers written in Hebrew letters, as chapters, verses and dapim are.

import { stripNikkud } from './letters.ts';

// Nine units, nine tens, then the four hundreds.
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const value = (letter: string): number => {
  const at = LETTERS.indexOf(letter);
  return ((at % 9) + 1) * 10 ** Math.floor(at / 9);
};

// A hundred, then a ten, then a unit, each at most once and in plain letters, never final ones.
// Fifteen and sixteen are written טו and טז, since יה and יו spell the divine name.
const NUMERAL = /^([קרשת]?)(?:(ט[וז])|([יכלמנסעפצ]?)([אבגדהוזחט]?))$/;

// Geresh and gershayim, and the quotes typed for them.
const GERESH = /['"`’‘׳״]/g;

/** `text` without points, geresh, gershayim or the quotes typed for them. */
export function withoutPointsOrGeresh(text: string): string {
  return stripNikkud(text).replace(GERESH, '');
}

/**
 * The number Hebrew letters write, 1 to 499, such as יז for 17, read past points, geresh
 * and gershayim; null for anything else, so most words are not numbers.
 */
export function hebrewNumber(text: string): number | null {
  const letters = withoutPointsOrGeresh(text);
  const match = letters.match(NUMERAL);
  if (!letters || !match) return null;
  if (match[3] === 'י' && (match[4] === 'ה' || match[4] === 'ו')) return null;
  return [...letters].reduce((sum, letter) => sum + value(letter), 0);
}
