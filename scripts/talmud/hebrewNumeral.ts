// Numbers written in Hebrew letters, as chapters, verses and dapim are numbered.

// Nine units, nine tens, then the hundreds.
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const value = (letter: string): number => {
  const at = LETTERS.indexOf(letter);
  return ((at % 9) + 1) * 10 ** Math.floor(at / 9);
};

// A hundred, then a ten, then a unit, each at most once. Fifteen and sixteen are
// written טו and טז, since יה and יו spell the divine name.
const NUMERAL = /^([קרשת]?)(?:(ט[וז])|([יכלמנסעפצ]?)([אבגדהוזחט]?))$/;

/** The number a Hebrew numeral writes, 1 to 499, read past any geresh or gershayim; null for anything else. */
export function hebrewNumeral(written: string): number | null {
  const letters = written.replace(/['"׳״]/g, '');
  const match = letters.match(NUMERAL);
  if (!letters || !match) return null;
  if (match[3] === 'י' && (match[4] === 'ה' || match[4] === 'ו')) return null;
  return [...letters].reduce((sum, letter) => sum + value(letter), 0);
}
