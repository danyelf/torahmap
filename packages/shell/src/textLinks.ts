import { wrapRuns } from './textRuns.ts';
import type { TextRange } from '@torahmap/utils';

/** A stretch of a text, as a link to `href`. */
export interface TextLink extends TextRange {
  href: string;
}

/** A link shown as its own `label` at offset `at` of a text, beside the text rather than in it. */
export interface TextReference {
  at: number;
  href: string;
  label: string;
}

/** The class of the anchor a link's stretch becomes. */
export const TEXT_LINK = 'text-link';

/** The class added to the anchor a reference becomes. */
export const TEXT_REFERENCE = 'text-reference';

function anchor(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = TEXT_LINK;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = text;
  return a;
}

/** `fragment` with each link's stretch of `text` wrapped in an anchor, over whatever marks it has. */
export function linkStretches(
  fragment: DocumentFragment,
  text: string,
  links: readonly TextLink[],
): DocumentFragment {
  if (links.length === 0) return fragment;
  return wrapRuns(
    fragment,
    text,
    (offset) => links.find((l) => l.start <= offset && offset < l.end) ?? null,
    (link, run) => anchor(link.href, run),
  );
}

/**
 * `container`, which shows a text, with each reference's label inserted where it belongs. The
 * labels are not the text: anything that reads the text by offset should do so before this.
 */
export function insertReferences(container: Element, references: readonly TextReference[]): void {
  for (const reference of [...references].sort((a, b) => b.at - a.at)) {
    const label = anchor(reference.href, reference.label);
    label.classList.add(TEXT_REFERENCE);
    const at = textPosition(container, reference.at);
    if (!at) {
      container.append(label);
      continue;
    }
    // Before the word, mark or link that starts there, not inside it.
    let before: Node = at.offset === 0 ? at.node : at.node.splitText(at.offset);
    while (before.parentNode !== container && before.parentNode!.firstChild === before) {
      before = before.parentNode!;
    }
    before.parentNode!.insertBefore(label, before);
  }
}

/** The text node and offset in it of `offset` in the container's text, counting no labels. */
function textPosition(container: Element, offset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (node.parentElement?.closest(`.${TEXT_REFERENCE}`)) continue;
    if (offset < seen + node.length) return { node, offset: offset - seen };
    seen += node.length;
  }
  return null;
}
