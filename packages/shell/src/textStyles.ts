import { wrapRuns } from './textRuns.ts';

/** Characters `start` to `end` of a text, in bold or italic. A bold and an italic stretch may overlap. */
export interface TextStyle {
  start: number;
  end: number;
  style: 'bold' | 'italic';
}

/** `fragment` with each styled stretch of `text` in <b> or <i>, over whatever marks it has. */
export function styleStretches(
  fragment: DocumentFragment,
  text: string,
  styles: readonly TextStyle[],
): DocumentFragment {
  if (styles.length === 0) return fragment;
  // Each character's styles, as one value per combination, so a run is a stretch of one.
  const bold = new Uint8Array(text.length);
  const italic = new Uint8Array(text.length);
  for (const { start, end, style } of styles)
    (style === 'bold' ? bold : italic).fill(1, start, end);
  return wrapRuns(
    fragment,
    text,
    (offset) => (bold[offset] ? (italic[offset] ? 'bi' : 'b') : italic[offset] ? 'i' : null),
    (owner, run) => {
      const outer = document.createElement(owner[0]);
      if (owner === 'bi') {
        const inner = document.createElement('i');
        inner.textContent = run;
        outer.append(inner);
      } else {
        outer.textContent = run;
      }
      return outer;
    },
  );
}
