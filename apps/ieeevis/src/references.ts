// A reference list's text with each numbered entry on a line of its own.

/** An entry's number: "[23]". */
export const NUMBER = String.raw`\[\d+\]`;

/** Where an entry starts: after the last one's end, at "[23] ". Only a reference list is read this way. */
export const referenceLines = (text: string): string =>
  text.replace(new RegExp(` (?=${NUMBER} )`, 'g'), '\n');
