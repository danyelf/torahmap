import { describe, it, expect } from "vitest";
import {
  walkMarkers,
  stripHtml,
  parseWholeRef,
  dafAmudToIdx,
} from "../../../scripts/talmud/bundle.ts";

describe("walkMarkers", () => {
  it("tags all segments after מתני׳ as mishnah", () => {
    const text = [["מתני׳ start", "continuation"], ["more"]];
    expect(walkMarkers(text)).toEqual([[true, true], [true]]);
  });

  it("flips to gemara on גמ׳", () => {
    const text = [["מתני׳ m1", "גמ׳ g1"], ["more g"]];
    expect(walkMarkers(text)).toEqual([[true, false], [false]]);
  });

  it("handles multi-perek alternation", () => {
    const text = [
      ["מתני׳ m1", "גמ׳ g1", "more g1"],
      ["הדרן end", "מתני׳ m2", "גמ׳ g2"],
    ];
    expect(walkMarkers(text)).toEqual([
      [true, false, false],
      [false, true, false],
    ]);
  });

  it("starts in gemara state (conservative default)", () => {
    expect(walkMarkers([["no marker", "here"]])).toEqual([[false, false]]);
  });

  it("handles embedded markers", () => {
    expect(walkMarkers([["prefix מתני׳ suffix", "next"]])).toEqual([
      [true, true],
    ]);
  });
});

describe("stripHtml", () => {
  it("removes <big> tags", () => {
    expect(stripHtml("<big>hello</big>")).toBe("hello");
  });

  it("removes <strong> tags", () => {
    expect(stripHtml("<strong>bold</strong> text")).toBe("bold text");
  });

  it("replaces <br/> with space", () => {
    expect(stripHtml("line1<br/>line2")).toBe("line1 line2");
    expect(stripHtml("line1<br>line2")).toBe("line1 line2");
  });

  it("preserves Hebrew text", () => {
    expect(stripHtml("<big>שלום</big>")).toBe("שלום");
  });
});

describe("parseWholeRef", () => {
  it("parses a standard range ref", () => {
    expect(parseWholeRef("Berakhot 2a:1-13a:15")).toEqual({
      startDaf: 2,
      startAmud: "a",
      startSegment: 1,
      endDaf: 13,
      endAmud: "a",
      endSegment: 15,
    });
  });

  it("parses a ref with a multi-word tractate", () => {
    expect(parseWholeRef("Rosh Hashanah 2a:1-8b:20")).toEqual({
      startDaf: 2,
      startAmud: "a",
      startSegment: 1,
      endDaf: 8,
      endAmud: "b",
      endSegment: 20,
    });
  });

  it("parses a shorthand same-daf segment range", () => {
    expect(parseWholeRef("Tamid 33a:8-14")).toEqual({
      startDaf: 33,
      startAmud: "a",
      startSegment: 8,
      endDaf: 33,
      endAmud: "a",
      endSegment: 14,
    });
  });

  it("returns null for unparseable refs", () => {
    expect(parseWholeRef("garbage")).toBeNull();
    expect(parseWholeRef("Berakhot 2")).toBeNull();
  });
});

describe("dafAmudToIdx", () => {
  it("maps daf 2a to index 0 when firstDaf=2", () => {
    expect(dafAmudToIdx(2, "a", 2)).toBe(0);
  });

  it("maps daf 2b to index 1", () => {
    expect(dafAmudToIdx(2, "b", 2)).toBe(1);
  });

  it("maps daf 3a to index 2", () => {
    expect(dafAmudToIdx(3, "a", 2)).toBe(2);
  });

  it("handles a tractate starting at daf 10", () => {
    expect(dafAmudToIdx(10, "a", 10)).toBe(0);
    expect(dafAmudToIdx(11, "b", 10)).toBe(3);
  });
});
