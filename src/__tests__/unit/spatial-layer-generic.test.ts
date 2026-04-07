import { describe, it, expect } from "vitest";
import type { SpatialItem, TanakhIdentity, TalmudIdentity } from "../../types.ts";
import { buildVerseGeometry } from "../../geometry.ts";
import { findExactHit, findFuzzyHit } from "../../hitDetection.ts";

// Synthetic third identity — not a real corpus, just proves the spatial
// layer doesn't care what T is. If this test file compiles, the spatial
// layer is provably identity-agnostic.
interface FooIdentity {
  foo: string;
  bar: number;
}

describe("spatial layer genericization", () => {
  it("buildVerseGeometry accepts SpatialItem<TanakhIdentity>", () => {
    const items: SpatialItem<TanakhIdentity>[] = [
      { book: "Genesis", chapter: 1, verse: 1, x: 10, y: 20, size: 6 },
      { book: "Genesis", chapter: 1, verse: 2, x: 16, y: 20, size: 6 },
    ];
    const geom = buildVerseGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildVerseGeometry accepts SpatialItem<TalmudIdentity>", () => {
    const items: SpatialItem<TalmudIdentity>[] = [
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 1, x: 10, y: 20, size: 6 },
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 2, x: 16, y: 20, size: 6 },
    ];
    const geom = buildVerseGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildVerseGeometry accepts a synthetic third identity (proof of opacity)", () => {
    const items: SpatialItem<FooIdentity>[] = [
      { foo: "x", bar: 42, x: 10, y: 20, size: 6 },
      { foo: "y", bar: 43, x: 16, y: 20, size: 6 },
    ];
    const geom = buildVerseGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildVerseGeometry produces byte-identical output for identical coordinates across different T", () => {
    const coords = [
      { x: 10, y: 20, size: 6 },
      { x: 16, y: 20, size: 6 },
    ];
    const tanakhItems: SpatialItem<TanakhIdentity>[] = coords.map((c, i) => ({
      book: "Genesis",
      chapter: 1,
      verse: i + 1,
      ...c,
    }));
    const talmudItems: SpatialItem<TalmudIdentity>[] = coords.map((c, i) => ({
      tractate: "Berakhot",
      daf: 2,
      amud: "a" as const,
      segment: i + 1,
      ...c,
    }));
    const fooItems: SpatialItem<FooIdentity>[] = coords.map((c, i) => ({
      foo: `f${i}`,
      bar: i,
      ...c,
    }));

    const gTanakh = buildVerseGeometry(tanakhItems);
    const gTalmud = buildVerseGeometry(talmudItems);
    const gFoo = buildVerseGeometry(fooItems);

    expect(gTalmud).toEqual(gTanakh);
    expect(gFoo).toEqual(gTanakh);
  });

  it("findExactHit accepts SpatialItem<TalmudIdentity>", () => {
    const items: SpatialItem<TalmudIdentity>[] = [
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 1, x: 10, y: 20, size: 6 },
    ];
    const hit = findExactHit(items, 12, 22);
    expect(hit).not.toBeNull();
    expect(hit?.tractate).toBe("Berakhot");
  });

  it("findFuzzyHit accepts SpatialItem<FooIdentity>", () => {
    const items: SpatialItem<FooIdentity>[] = [
      { foo: "x", bar: 1, x: 10, y: 20, size: 6 },
    ];
    const hit = findFuzzyHit(items, 12, 22);
    expect(hit).not.toBeNull();
    expect(hit?.foo).toBe("x");
  });
});
