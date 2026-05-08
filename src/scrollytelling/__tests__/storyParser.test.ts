import { describe, it, expect } from 'vitest';
import { parseStoryMarkdown } from '../storyParser';

describe('parseStoryMarkdown', () => {
  it('parses frontmatter defaults', () => {
    const md = `---
easing: ease-in-out
---

<!-- stop: intro | camera: initial -->
# Hello

Text here.`;

    const data = parseStoryMarkdown(md);
    expect(data.defaults?.easing).toBe('ease-in-out');
  });

  it('parses stops from comments', () => {
    const md = `<!-- stop: intro | camera: initial -->
# The Torah Map

Every verse of the Tanakh.

<!-- stop: abraham | camera: initial | overlay: search | q: אברהם -->
# Abraham's Journey

Abraham first appears in Genesis 12.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops).toHaveLength(2);
    expect(data.stops[0].id).toBe('intro');
    expect(data.stops[0].title).toBe('The Torah Map');
    expect(data.stops[0].text).toBe('Every verse of the Tanakh.');
    expect(data.stops[0].camera).toBe('initial');
    expect(data.stops[0].overlay).toBeNull();

    expect(data.stops[1].id).toBe('abraham');
    expect(data.stops[1].overlay).toBe('search');
    expect(data.stops[1].overlayParams).toEqual({ q: 'אברהם' });
  });

  it('parses camera coordinates', () => {
    const md = `<!-- stop: zoomed | camera: -2000,40,2.5 -->
# Zoomed View

Content.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].camera).toEqual({ x: -2000, y: 40, zoom: 2.5 });
  });

  it('parses easing per stop', () => {
    const md = `<!-- stop: intro | camera: initial | easing: linear -->
# Intro

Text.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].easing).toBe('linear');
  });

  it('handles markdown in text (preserves raw markdown)', () => {
    const md = `<!-- stop: intro | camera: initial -->
# Title

This has **bold** and a [link](https://example.com).

And a second paragraph.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].text).toContain('**bold**');
    expect(data.stops[0].text).toContain('[link]');
    expect(data.stops[0].text).toContain('second paragraph');
  });

  it('works with no frontmatter', () => {
    const md = `<!-- stop: intro | camera: initial -->
# Hello

World.`;

    const data = parseStoryMarkdown(md);
    expect(data.defaults).toBeUndefined();
    expect(data.stops).toHaveLength(1);
  });

  it('parses verse pin', () => {
    const md = `<!-- stop: genesis | camera: initial | verse: Genesis.1.1 -->
# Genesis

In the beginning.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].verse).toBe('Genesis.1.1');
  });

  it('parses camera as verse reference', () => {
    const md = `<!-- stop: abram | camera: Genesis.12.1 -->
# Abram

Lekh lekha.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].camera).toEqual({ kind: 'verse', ref: 'Genesis.12.1' });
    expect(data.stops[0].zoom).toBeUndefined();
  });

  it('parses camera as verse reference with explicit zoom', () => {
    const md = `<!-- stop: friend | camera: Isaiah.41.8 | zoom: 6 -->
# Friend

Text.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].camera).toEqual({ kind: 'verse', ref: 'Isaiah.41.8' });
    expect(data.stops[0].zoom).toBe(6);
  });

  it('parses multi-word book in verse-ref camera', () => {
    const md = `<!-- stop: hannah | camera: I.Samuel.1.5 -->
# Hannah

Text.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].camera).toEqual({ kind: 'verse', ref: 'I.Samuel.1.5' });
  });

  it('falls back to initial when camera is unparseable', () => {
    const md = `<!-- stop: bogus | camera: not-a-real-thing -->
# Bogus

Text.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].camera).toBe('initial');
  });

  it('handles stop with no overlay params', () => {
    const md = `<!-- stop: intro | camera: initial | overlay: haftarah -->
# Haftarah

Text.`;

    const data = parseStoryMarkdown(md);
    expect(data.stops[0].overlay).toBe('haftarah');
    expect(data.stops[0].overlayParams).toBeUndefined();
  });
});
