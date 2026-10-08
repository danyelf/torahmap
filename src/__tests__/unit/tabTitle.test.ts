import { describe, it, expect } from 'vitest';
import { readLink } from '@torahmap/link';
import { tabTitle } from '../../tabTitle';
import { tanakhSite } from '../../tanakh/site';
import { talmudSite } from '../../talmud/site';

describe('tabTitle', () => {
  it('is the view’s title alone on the live site', () => {
    expect(tabTitle(tanakhSite, readLink('?verse=Genesis.12.1'), null)).toBe(
      'Genesis 12:1 · Torahmap',
    );
  });

  it('keeps the branch name anywhere else', () => {
    expect(tabTitle(tanakhSite, readLink('?verse=Genesis.12.1'), 'share-view-2')).toBe(
      'Genesis 12:1 · Torahmap [share-view-2]',
    );
  });

  it('names a story by its real title', () => {
    expect(tabTitle(tanakhSite, readLink('?story=tour&stop=intro'), null)).toBe(
      'The Guided Tour · Torahmap',
    );
  });

  it('names a pinned square in the words of its own text', () => {
    expect(tabTitle(talmudSite, readLink('?verse=Bava.Kamma.2a.1'), null)).toBe(
      `Bava Kamma 2a:1 · ${talmudSite.name}`,
    );
  });

  it('names the search on either text', () => {
    expect(tabTitle(talmudSite, readLink('?search=light'), null)).toBe(
      tabTitle(tanakhSite, readLink('?search=light'), null).replace(
        tanakhSite.name,
        talmudSite.name,
      ),
    );
  });

  it('is the site’s name alone with nothing pinned', () => {
    expect(tabTitle(talmudSite, readLink(''), null)).toBe(talmudSite.name);
  });
});
