import { describe, it, expect, vi } from 'vitest';
import { cameraSetting, parseStoryMarkdown, writeStopComment } from '../src/parser';

const parse = (md: string) => parseStoryMarkdown(md, new Set(['search', 'mode']));

describe('parseStoryMarkdown', () => {
  it('parses the frontmatter easing', () => {
    const md = `---
easing: ease-in-out
---

<!-- stop: intro | camera: initial -->
# Hello

Text here.`;

    const data = parse(md);
    expect(data.easing).toBe('ease-in-out');
  });

  it('parses stops from comments', () => {
    const md = `<!-- stop: intro | camera: initial -->
# The Torah Map

Every verse of the Tanakh.

<!-- stop: abraham | camera: initial | search: אברהם -->
# Abraham's Journey

Abraham first appears in Genesis 12.`;

    const data = parse(md);
    expect(data.stops).toHaveLength(2);
    expect(data.stops[0].id).toBe('intro');
    expect(data.stops[0].title).toBe('The Torah Map');
    expect(data.stops[0].text).toBe('Every verse of the Tanakh.');
    expect(data.stops[0].camera).toBe('initial');
    expect(data.stops[0].overlay).toBeNull();

    expect(data.stops[1].id).toBe('abraham');
    expect(data.stops[1].overlay).toBeNull();
    expect(data.stops[1].searchParams).toEqual({ search: 'אברהם' });
  });

  it('sends the search its own keys and the overlay the rest', () => {
    const md = `<!-- stop: both | camera: initial | search: אברם,אברהם | mode: ,w | overlay: commentary | category: Liturgy -->
# Both

Text.`;
    const [stop] = parse(md).stops;
    expect(stop.searchParams).toEqual({ search: 'אברם,אברהם', mode: ',w' });
    expect(stop.overlay).toBe('commentary');
    expect(stop.overlayParams).toEqual({ category: 'Liturgy' });
  });

  it('lets a stop search with no overlay', () => {
    const [stop] = parse(`<!-- stop: s | camera: initial | search: אברם -->\n# S\n\nText.`).stops;
    expect(stop.overlay).toBeNull();
    expect(stop.overlayParams).toBeUndefined();
    expect(stop.searchParams).toEqual({ search: 'אברם' });
  });

  it('parses camera coordinates', () => {
    const md = `<!-- stop: zoomed | camera: -2000,40,2.5 -->
# Zoomed View

Content.`;

    const data = parse(md);
    expect(data.stops[0].camera).toEqual({ x: -2000, y: 40, zoom: 2.5 });
  });

  it('parses easing per stop', () => {
    const md = `<!-- stop: intro | camera: initial | easing: linear -->
# Intro

Text.`;

    const data = parse(md);
    expect(data.stops[0].easing).toBe('linear');
  });

  it('handles markdown in text (preserves raw markdown)', () => {
    const md = `<!-- stop: intro | camera: initial -->
# Title

This has **bold** and a [link](https://example.com).

And a second paragraph.`;

    const data = parse(md);
    expect(data.stops[0].text).toContain('**bold**');
    expect(data.stops[0].text).toContain('[link]');
    expect(data.stops[0].text).toContain('second paragraph');
  });

  it('works with no frontmatter', () => {
    const md = `<!-- stop: intro | camera: initial -->
# Hello

World.`;

    const data = parse(md);
    expect(data.easing).toBeUndefined();
    expect(data.stops).toHaveLength(1);
  });

  it('parses the square a stop pins', () => {
    const md = `<!-- stop: genesis | camera: initial | pin: Genesis.1.1 -->
# Genesis

In the beginning.`;

    const data = parse(md);
    expect(data.stops[0].pin).toBe('Genesis.1.1');
  });

  it('parses a camera naming one place', () => {
    const md = `<!-- stop: abram | camera: Genesis.12.1 -->
# Abram

Lekh lekha.`;

    const data = parse(md);
    expect(data.stops[0].camera).toEqual({ kind: 'places', names: ['Genesis.12.1'] });
    expect(data.stops[0].zoom).toBeUndefined();
  });

  it('parses a camera naming several places, at a zoom', () => {
    const md = `<!-- stop: rest | camera: Neviim, I.Samuel.1.5, | zoom: 0.4 -->
# Rest

Text.`;

    const data = parse(md);
    expect(data.stops[0].camera).toEqual({ kind: 'places', names: ['Neviim', 'I.Samuel.1.5'] });
    expect(data.stops[0].zoom).toBe(0.4);
  });

  it('handles stop with no overlay params', () => {
    const md = `<!-- stop: intro | camera: initial | overlay: haftarah -->
# Haftarah

Text.`;

    const data = parse(md);
    expect(data.stops[0].overlay).toBe('haftarah');
    expect(data.stops[0].overlayParams).toBeUndefined();
  });

  it('leaves the title empty when a stop has no heading', () => {
    const md = `<!-- stop: untitled | camera: initial -->
Each book is a column.`;

    const data = parse(md);
    expect(data.stops[0].title).toBeUndefined();
    expect(data.stops[0].text).toBe('Each book is a column.');
  });

  it('reports a stop id used twice', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const md = `<!-- stop: abram | camera: initial -->
Text.

<!-- stop: abram | camera: initial | pin: Genesis.12.1 -->
Text.`;

    parse(md);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"abram"'));
    error.mockRestore();
  });
});

describe('story frontmatter', () => {
  const md = [
    '---',
    'title: Prose and Poetry: Job',
    'description: The prose frame and the poem look different.',
    'easing: linear',
    '---',
    '',
    '<!-- stop: a | camera: Job -->',
    'Text.',
  ].join('\n');

  it('reads the title and description, colons and all', () => {
    const story = parse(md);
    expect(story.title).toBe('Prose and Poetry: Job');
    expect(story.description).toBe('The prose frame and the poem look different.');
    expect(story.easing).toBe('linear');
  });

  it('reads the order as a number and a draft as true', () => {
    const story = parse('---\norder: 2.5\ndraft: true\n---\n');
    expect(story.order).toBe(2.5);
    expect(story.draft).toBe(true);
  });

  it('gives no order for a value that is not a number, and is not a draft unless it says so', () => {
    const story = parse('---\norder: first\ndraft: no\n---\n');
    expect(story.order).toBeUndefined();
    expect(story.draft).toBe(false);
  });

  it('leaves them empty when the story has no frontmatter', () => {
    const story = parse('<!-- stop: a | camera: Job -->\nText.');
    expect(story.title).toBe('');
    expect(story.description).toBe('');
    expect(story.draft).toBe(false);
  });
});

describe('easing', () => {
  it('refuses a name it does not know', () => {
    expect(() => parse('---\neasing: bouncy\n---\n')).toThrow(/bouncy/);
    expect(() => parse('<!-- stop: a | easing: bouncy -->\nText.')).toThrow(/bouncy/);
  });
});

describe('writeStopComment', () => {
  it('writes a stop the parser reads back', () => {
    const comment = writeStopComment(
      'abraham',
      {
        camera: cameraSetting({ x: 12.345, y: -6.7, zoom: 2.5 }),
        overlay: 'haftarah',
        pin: 'I.Samuel.1.5',
      },
      { custom: 'sephardi', search: 'אברהם' },
    );
    const [stop] = parse(`${comment}\nText.`).stops;
    expect(stop).toMatchObject({
      id: 'abraham',
      camera: { x: 12.35, y: -6.7, zoom: 2.5 },
      overlay: 'haftarah',
      overlayParams: { custom: 'sephardi' },
      searchParams: { search: 'אברהם' },
      pin: 'I.Samuel.1.5',
    });
  });
});
