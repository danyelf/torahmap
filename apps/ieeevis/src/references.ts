// A reference list's text with each numbered entry on a line of its own.

/** Where an entry starts: after the last one's end, at "[23] ". Only a reference list is read this way. */
export const referenceLines = (text: string): string => text.replace(/ (?=\[\d+\] )/g, '\n');
