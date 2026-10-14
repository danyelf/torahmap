# EU AI Act map — exploration

Whether the Torah Map's model — every unit of a text in a fixed place, with
overlays on top — works for a very different text: the EU AI Act. The design
and the decisions so far are in
[`docs/plans/2026-10-13-eu-ai-act-map-design.md`](../../docs/plans/2026-10-13-eu-ai-act-map-design.md).

Standard-library Python only (3.9 or later); no virtual environment needed.

## What is here

- `downloads/02024R1689-20260727.xhtml` — the consolidated text as of
  27 July 2026: the 2024 Act with Regulation (EU) 2026/1744 folded in. Articles
  and annexes, with markers for what the amendment inserted, replaced or
  deleted. No recitals; consolidated texts leave out the preamble.
- `downloads/32024R1689-original.xhtml` — the 2024 Official Journal text, read
  only for its 180 recitals.
- `parse.py` → `ai-act.json` — both texts as one tree: recitals; chapters →
  sections → articles → paragraphs → points; annexes → parts → paragraphs →
  points. Every paragraph and point records its origin: `B` (2024),
  `M1 inserted` or `M1 replaced`.
- `refs.py` → `refs.json` — every reference the articles make to the Act's own
  articles, paragraphs, points and annexes, resolved to a unit id such as `6`,
  `6(2)`, `5(1)(h)` or `Annex III`. References to other laws are left out.
- `stats.py` — sizes of each candidate unit.
- `render.py` — draws the map as SVG, coloured by amendment, or with
  `--focus <article>` to show what one article cites and what cites it.

## Run it

```bash
python3 -I experiments/eu-ai-act/parse.py
python3 -I experiments/eu-ai-act/refs.py
python3 -I experiments/eu-ai-act/render.py map.svg
python3 -I experiments/eu-ai-act/render.py article-6.svg --focus 6
```

## Fetching the text again

EUR-Lex answers scripted requests with a JavaScript bot check. The Publications
Office serves the same documents by CELEX number without one:

```bash
curl -sSL -H "Accept: application/xhtml+xml" -H "Accept-Language: eng" \
  -o downloads/02024R1689-20260727.xhtml \
  http://publications.europa.eu/resource/celex/02024R1689-20260727
```

A later consolidation has a later date in its CELEX number, and adds `M2`,
`M3` … markers for each further amending act.

## Known gaps

- A unit id leaves out "first subparagraph": `5(1)(h)` stands for "Article
  5(1), first subparagraph, point (h)".
- A point cited alone ("point (a)", with no paragraph or article) is not
  resolved; there are about a dozen.
- Article 3's definitions and Article 113's dates are unnumbered blocks of
  points, so their ids read like paragraphs: `3(14)` is definition 14.
