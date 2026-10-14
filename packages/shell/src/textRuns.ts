/**
 * `fragment` with each run of characters `ownerAt` gives the same owner replaced by
 * `wrap(owner, run)`, and runs with no owner left as text.
 *
 * The fragment may come from an overlay that has wrapped parts of the text in <mark> elements:
 * search marks whole matches, trop marks single accents inside words. Rather than fight that, this
 * walks the text nodes in order and keeps count of where it is in `text`, so a run a mark cuts
 * across is wrapped on each side of the mark's edge. Text inside an element `skip` accepts is
 * counted but left as it is.
 *
 * Offsets count in `text`. Nothing upstream guarantees the fragment's text is `text` (an overlay
 * could hand back text that has drifted from its item), so a fragment whose text is not is
 * returned unwrapped: inert rather than wrong.
 */
export function wrapRuns<T>(
  fragment: DocumentFragment,
  text: string,
  ownerAt: (offset: number) => T | null,
  wrap: (owner: T, run: string) => Node,
  skip: (element: Element) => boolean = () => false,
): DocumentFragment {
  if (fragment.textContent !== text) {
    console.warn('wrapRuns: fragment text does not match the item text, leaving it unwrapped', {
      fragmentText: fragment.textContent,
      itemText: text,
    });
    return fragment;
  }

  let offset = 0;
  const walk = (node: Node): void => {
    // Copy the child list first: wrapping replaces nodes as it goes.
    for (const child of [...node.childNodes]) {
      if (child instanceof Element && skip(child)) {
        offset += child.textContent?.length ?? 0;
      } else if (child.nodeType === Node.TEXT_NODE) {
        const content = child.textContent ?? '';
        const pieces = document.createDocumentFragment();
        let cursor = 0;
        while (cursor < content.length) {
          const owner = ownerAt(offset + cursor);
          let run = cursor + 1;
          while (run < content.length && ownerAt(offset + run) === owner) run++;
          const slice = content.slice(cursor, run);
          pieces.append(owner === null ? slice : wrap(owner, slice));
          cursor = run;
        }
        offset += content.length;
        child.parentNode?.replaceChild(pieces, child);
      } else {
        walk(child);
      }
    }
  };
  walk(fragment);
  return fragment;
}
