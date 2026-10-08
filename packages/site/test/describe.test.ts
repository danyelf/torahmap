import { describe, it, expect } from 'vitest';
import { readLink } from '@torahmap/link';
import { LINK_KEYS } from '@torahmap/overlay-catalog';
import { describeLink, TAGLINE } from '@torahmap/site';

const describeQuery = (q: string) => describeLink(readLink(q, LINK_KEYS));

describe('describeLink', () => {
  it('names a pinned verse, with the overlay in the description', () => {
    expect(describeQuery('?verse=Genesis.12.1&overlay=commentary')).toEqual({
      title: 'Genesis 12:1 · Torahmap',
      description: `Commentary overlay. ${TAGLINE}`,
    });
  });

  it('names a search', () => {
    expect(describeQuery('?search=אברם')).toEqual({
      title: 'Search: אברם · Torahmap',
      description: TAGLINE,
    });
  });

  it('puts the verse before the search', () => {
    expect(describeQuery('?search=אברם&overlay=commentary&verse=Genesis.12.1')).toEqual({
      title: 'Genesis 12:1 · Search: אברם · Torahmap',
      description: `Commentary overlay. ${TAGLINE}`,
    });
  });

  it('names a story stop by its story, and opens with the stop', () => {
    expect(describeQuery('?story=tour&stop=abraham_zoom')).toEqual({
      title: 'The Guided Tour · Torahmap',
      description: `We can overlay the map with data. ${TAGLINE}`,
    });
  });

  it('names a stop alone by the story torahmap.org opens by default', () => {
    expect(describeQuery('?stop=abraham_zoom')).toEqual(
      describeQuery('?story=tour&stop=abraham_zoom'),
    );
    expect(describeQuery('?stop=abraham_zoom&verse=Genesis.1.1')).toEqual(
      describeQuery('?story=tour&stop=abraham_zoom'),
    );
    expect(describeQuery('?stop=no-such-stop')).toEqual({
      title: 'The Guided Tour · Torahmap',
      description: TAGLINE,
    });
  });

  it('names the site alone for the plain map or a camera', () => {
    const plain = { title: 'Torahmap', description: TAGLINE };
    expect(describeQuery('')).toEqual(plain);
    expect(describeQuery('?zoom=2&x=10&y=20')).toEqual(plain);
  });

  it('writes a book with a number the way readers do', () => {
    expect(describeQuery('?verse=I.Samuel.1.5').title).toBe('I Samuel 1:5 · Torahmap');
  });

  it('names no verse the page would not pin', () => {
    expect(describeQuery('?verse=Genesis.01.1')).toEqual(describeQuery('?zoom=2'));
  });

  it('names a draft or unknown story by the story the page opens instead', () => {
    const tour = { title: 'The Guided Tour · Torahmap', description: TAGLINE };
    expect(describeQuery('?story=sample')).toEqual(tour);
    expect(describeQuery('?story=gone')).toEqual(tour);
    expect(describeQuery('?story=gone&stop=abraham_zoom')).toEqual(
      describeQuery('?story=tour&stop=abraham_zoom'),
    );
  });

  it('describes an unknown stop or overlay as if it were absent', () => {
    expect(describeQuery('?overlay=text-dating').description).toBe(TAGLINE);
    expect(describeQuery('?story=tour&stop=no-such-stop').description).toBe(TAGLINE);
  });
});
