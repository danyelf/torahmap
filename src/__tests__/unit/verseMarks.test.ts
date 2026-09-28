import { describe, it, expect } from 'vitest';
import { combineMarks } from '../../verseMarks';

const TEXT = 'In the beginning';

/** TEXT with each [start, end, class] wrapped in a mark of that class. */
function marked(...marks: [number, number, string][]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let at = 0;
  for (const [start, end, cls] of marks) {
    fragment.append(TEXT.slice(at, start));
    const mark = document.createElement('mark');
    mark.className = cls;
    mark.textContent = TEXT.slice(start, end);
    fragment.append(mark);
    at = end;
  }
  fragment.append(TEXT.slice(at));
  return fragment;
}

function describeMarks(fragment: DocumentFragment): string[] {
  expect(fragment.textContent).toBe(TEXT);
  return [...fragment.querySelectorAll('mark')].map((m) => `${m.className}:${m.textContent}`);
}

describe('combineMarks', () => {
  it("keeps the overlay's marks where the search marks nothing", () => {
    const combined = combineMarks(TEXT, marked([0, 2, 'trop']), marked());
    expect(describeMarks(combined)).toEqual(['trop:In']);
  });

  it("keeps the search's marks where the overlay marks nothing", () => {
    const combined = combineMarks(TEXT, marked(), marked([7, 16, 'term-0']));
    expect(describeMarks(combined)).toEqual(['term-0:beginning']);
  });

  it('keeps both where they mark different words', () => {
    const combined = combineMarks(TEXT, marked([0, 2, 'trop']), marked([7, 16, 'term-0']));
    expect(describeMarks(combined)).toEqual(['trop:In', 'term-0:beginning']);
  });

  it("keeps the search's mark where both mark the same word", () => {
    const combined = combineMarks(
      TEXT,
      marked([0, 2, 'trop'], [8, 9, 'trop']),
      marked([7, 16, 'term-0']),
    );
    expect(describeMarks(combined)).toEqual(['trop:In', 'term-0:beginning']);
  });

  it("falls back to the search's marks when a fragment is not this text", () => {
    const other = document.createDocumentFragment();
    other.append('something else');
    const combined = combineMarks(TEXT, other, marked([7, 16, 'term-0']));
    expect(describeMarks(combined)).toEqual(['term-0:beginning']);
  });
});
