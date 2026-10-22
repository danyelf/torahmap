import { wrapRuns } from './textRuns.ts';
import type { TextRange } from './textStyles.ts';

/** A stretch of a text, as a link to `href`. */
export interface TextLink extends TextRange {
  href: string;
}

/** The class of the anchor a link's stretch becomes. */
export const TEXT_LINK = 'text-link';

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
