// Stretches of a square's text that link somewhere, laid over whatever marks the text already has.

/** Characters `start` to `end` of a text, as a link to `href`. */
export interface TextLink {
  start: number;
  end: number;
  href: string;
}

function anchor(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'text-link';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = text;
  return a;
}

/**
 * `fragment` with each link's stretch of `text` wrapped in an anchor. A stretch a mark cuts
 * across becomes an anchor on each side of the mark's edge. Offsets count in `text`, so a fragment
 * whose text is not `text` is returned as it is.
 */
export function linkStretches(
  fragment: DocumentFragment,
  text: string,
  links: readonly TextLink[],
): DocumentFragment {
  if (links.length === 0 || fragment.textContent !== text) return fragment;
  const linkAt = (offset: number) => links.find((l) => l.start <= offset && offset < l.end);

  let offset = 0;
  const walk = (node: Node): void => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== Node.TEXT_NODE) {
        walk(child);
        continue;
      }
      const content = child.textContent ?? '';
      const pieces = document.createDocumentFragment();
      let cursor = 0;
      while (cursor < content.length) {
        const link = linkAt(offset + cursor);
        let run = cursor + 1;
        while (run < content.length && linkAt(offset + run) === link) run++;
        const slice = content.slice(cursor, run);
        pieces.append(link ? anchor(link.href, slice) : slice);
        cursor = run;
      }
      offset += content.length;
      child.parentNode?.replaceChild(pieces, child);
    }
  };
  walk(fragment);
  return fragment;
}
