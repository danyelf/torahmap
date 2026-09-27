// Two tools each hand back a verse's text with some stretches wrapped in a
// mark; this lays both sets of marks over the one text.

interface Marked {
  start: number;
  end: number;
  element: Element;
}

/** The marked stretches of `fragment`, or null when its text is not `text`. */
function marksIn(fragment: DocumentFragment, text: string): Marked[] | null {
  if (fragment.textContent !== text) return null;
  const marks: Marked[] = [];
  let at = 0;
  for (const node of [...fragment.childNodes]) {
    const length = node.textContent?.length ?? 0;
    if (node instanceof Element) marks.push({ start: at, end: at + length, element: node });
    at += length;
  }
  return marks;
}

/**
 * `under`'s marks and `over`'s in one fragment of `text`. A mark of `under`
 * that shares any character with one of `over`'s is dropped: two marks cannot
 * cover one letter, and `over` is the search the reader typed.
 */
export function combineMarks(
  text: string,
  under: DocumentFragment,
  over: DocumentFragment,
): DocumentFragment {
  const top = marksIn(over, text);
  const bottom = marksIn(under, text);
  if (!top || !bottom) return over;

  const kept = bottom.filter((b) => !top.some((t) => b.start < t.end && t.start < b.end));
  const fragment = document.createDocumentFragment();
  let at = 0;
  for (const { start, end, element } of [...top, ...kept].sort((a, b) => a.start - b.start)) {
    if (start > at) fragment.append(text.slice(at, start));
    fragment.append(element);
    at = end;
  }
  if (at < text.length) fragment.append(text.slice(at));
  return fragment;
}
