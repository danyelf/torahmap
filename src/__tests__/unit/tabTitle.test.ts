import { describe, it, expect } from 'vitest';
import { readLink } from '@torahmap/link';
import { tabTitle } from '../../tabTitle';

describe('tabTitle', () => {
  it('is the view’s title on the live site', () => {
    expect(tabTitle(readLink('?verse=Genesis.12.1'), 'main')).toBe('Genesis 12:1 · Torahmap');
  });

  it('keeps the branch name anywhere else', () => {
    expect(tabTitle(readLink('?verse=Genesis.12.1'), 'share-view-2')).toBe(
      'Genesis 12:1 · Torahmap [share-view-2]',
    );
  });

  it('names a story by its real title', () => {
    expect(tabTitle(readLink('?story=tour&stop=intro'), 'main')).toBe('The Guided Tour · Torahmap');
  });
});
