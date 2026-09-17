# Shared Legend Axis Design

**Date:** 2026-09-17
**Status:** Approved, being implemented.

## Problem

Commentary and Verse Length both draw a colour scale, and they do it in
unrelated ways. The duplication has already caused two defects.

**Verse Length's legend is broken on main.** `#overlay-legend .legend-row` is
`display: flex`. Verse Length uses that class as a plain block with two stacked
children — a gradient bar, and the min and max labels beneath it. As a flex row
they sit side by side, so the bar takes the width and the labels are crushed
into a column at the right, reading as "2 36 / words words".

**Commentary's legend shows colours its map does not use.** Verses are coloured
by `heatmapColor`: dark blue, light blue, teal, orange, red. The strip above the
tick labels comes from a fixed `linear-gradient` in `commentary.css` — navy
through to pink, with no teal or orange in it. The two are never seen side by
side, so nobody noticed.

Two more faults are visible in Commentary's legend:

- A tick label is centred on its position, so the labels at 0% and 100% hang
  half of themselves off the strip.
- Ticks are the powers of ten with the maximum added on the end, and on a log
  scale the maximum often lands almost on the last power of ten. On Halakhah
  they are 100 and 113, 2.6% apart — about nine pixels, with labels twice that
  wide. They overprint and read as "1003".
- A tick of 1015 renders as `1.015k`: the abbreviation is unwanted and the
  division is unrounded.

## The scale

One value carries what an overlay knows about its numbers, and both the verse
colours and the legend read it.

```ts
scale(low, high, transform, palette) -> {
  positionOf(value)   // 0..1 across the strip
  colorOf(value)      // interpolateGradient(positionOf(value), palette)
  palette
}

positionOf(v) = (transform(v) - transform(low)) / (transform(high) - transform(low))
```

There are two transforms and no reason to expect a third, so they are constants
rather than an extension point:

```ts
export const LOG = (v: number) => Math.log(v + 1);
export const SQRT = Math.sqrt;
```

This reproduces both overlays exactly, which is why no verse changes colour:

- `scale(0, max, LOG, …)` gives `log(v+1) / log(max+1)`, which is what
  `scaleToGradient(…, { useLog: true })` computes today.
- `scale(min, max, SQRT, …)` gives `(√v − √min) / (√max − √min)`, which is what
  `getVerseColorForWordCount` computes today.

A verse with nothing to show — no links, no words — is dark grey. That is a
statement about absent data, not about the scale, so it stays in each overlay's
`getVerseColor`.

`heatmapColor` becomes dead once Commentary has a scale, since nothing else
calls it, and is deleted. Its tests move onto the scale.

## The axis

`renderAxis` takes a scale and the tick values, and returns the strip and its
labels. It owns the four things each caller would otherwise decide for itself:

- **The strip.** Sampled from the scale's palette, so it cannot drift from the
  colours on the map.
- **Formatting.** `toLocaleString()`, so 1015 reads `1,015`. A caller that needs
  a unit passes its own formatter; Verse Length prints "36 words".
- **The two end labels.** The first aligns from its left edge and the last from
  its right, so neither hangs off the strip, while their tick marks stay on the
  position they name.
- **Crowding.** When two labels would print on top of each other, the later one
  wins. On Halakhah, 113 replaces 100 rather than colliding with it. The rule is
  about labels overlapping, not about powers of ten.

The axis's stylesheet is `src/styles/legend-axis.css`, imported by the module
that draws the axis rather than by any overlay. Trop's legend currently depends
on `.legend-gradient` arriving from a file named for Commentary, which works
only because Commentary happens to be imported too; giving the axis its own
stylesheet is what stops the next such borrowing.

## What each overlay ends up with

**Commentary** keeps its ticks at the powers of ten plus the maximum, and loses
the hand-written gradient. Its strip gains the teal and orange its map has had
all along.

**Verse Length** comes off `.legend-row`, which is what breaks it. It keeps its
two end labels and its three caption lines; it gains no interior ticks, because
it never had any.

**Trop** does not move onto the axis. It gets its own stops and its own gradient
rule in `trop.css`, so that nothing of it depends on Commentary.

## Testing

The axis is tested directly: tick positions under both transforms, the
formatter, the crowding rule in both directions, and the end-label classes. The
scale is tested for the two mappings above and for the palette it hands back.

Each overlay keeps a test that it feeds the axis the right ticks, and one that
pins its verse colours, since the point of the scale's algebra is that those do
not move.
