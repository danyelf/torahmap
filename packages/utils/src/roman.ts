// Roman numerals, as numbered books and the Act's annexes are written.

const NUMERALS: [number, string][] = [
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** `n`, from 1 to 399, in Roman numerals: 3 → "III". */
export function toRoman(n: number): string {
  let out = '';
  for (const [value, letters] of NUMERALS) {
    for (; n >= value; n -= value) out += letters;
  }
  return out;
}

/** The number Roman numerals write, in either case, as `toRoman` writes it; null for anything else. */
export function fromRoman(text: string): number | null {
  const upper = text.toUpperCase();
  if (!/^[CLXVI]+$/.test(upper)) return null;
  let n = 0;
  let rest = upper;
  for (const [value, letters] of NUMERALS) {
    while (rest.startsWith(letters)) {
      n += value;
      rest = rest.slice(letters.length);
    }
  }
  return rest === '' && toRoman(n) === upper ? n : null;
}
