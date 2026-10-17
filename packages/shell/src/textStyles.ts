import { wrapRuns } from './textRuns.ts';

/** Characters `start` to `end` of a text, in bold or italic. A bold and an italic stretch may overlap. */
export interface TextStyle {
  start: number;
  end: number;
  style: 'bold' | 'italic';
}

const BIT = { bold: 1, italic: 2 } as const;

/** A run in <b>, <i>, or <b><i> for both. */
function styled(bits: number, run: string): Node {
  let node: Node = document.createTextNode(run);
  for (const [tag, bit] of [
    ['i', BIT.italic],
    ['b', BIT.bold],
  ] as const) {
    if (!(bits & bit)) continue;
    const element = document.createElement(tag);
    element.append(node);
    node = element;
  }
  return node;
}

/** `fragment` with each styled stretch of `text` in <b> or <i>, over whatever marks it has. */
export function styleStretches(
  fragment: DocumentFragment,
  text: string,
  styles: readonly TextStyle[],
): DocumentFragment {
  if (styles.length === 0) return fragment;
  const bits = new Uint8Array(text.length);
  for (const { start, end, style } of styles) {
    for (let i = start; i < end; i++) bits[i] |= BIT[style];
  }
  return wrapRuns(fragment, text, (offset) => bits[offset] || null, styled);
}
