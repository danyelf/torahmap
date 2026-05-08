import { describe, it, expect } from "vitest";
import type { SpatialItem, TanakhIdentity, TalmudIdentity } from "../../types.ts";
import { buildItemGeometry } from "../../geometry.ts";
import { findExactHit } from "../../hitDetection.ts";

describe("spatial layer genericization", () => {
  it("buildItemGeometry accepts SpatialItem<TanakhIdentity>", () => {
    const items: SpatialItem<TanakhIdentity>[] = [
      { book: "Genesis", chapter: 1, verse: 1, x: 10, y: 20, size: 6 },
      { book: "Genesis", chapter: 1, verse: 2, x: 16, y: 20, size: 6 },
    ];
    const geom = buildItemGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("buildItemGeometry accepts SpatialItem<TalmudIdentity>", () => {
    const items: SpatialItem<TalmudIdentity>[] = [
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 1, x: 10, y: 20, size: 6 },
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 2, x: 16, y: 20, size: 6 },
    ];
    const geom = buildItemGeometry(items);
    expect(geom).toBeInstanceOf(Float32Array);
    expect(geom.length).toBeGreaterThan(0);
  });

  it("findExactHit accepts SpatialItem<TalmudIdentity>", () => {
    const items: SpatialItem<TalmudIdentity>[] = [
      { tractate: "Berakhot", daf: 2, amud: "a", segment: 1, x: 10, y: 20, size: 6 },
    ];
    const hit = findExactHit(items, 12, 22);
    expect(hit).not.toBeNull();
    expect(hit?.tractate).toBe("Berakhot");
  });
});
