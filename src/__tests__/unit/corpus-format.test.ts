import { describe, it, expect } from "vitest";
import {
  formatReference,
  serializeToUrlHash,
  parseFromUrlHash,
} from "../../corpus-format.ts";
import { TANAKH_SCHEMA, TALMUD_SCHEMA } from "../../corpusSchema.ts";
import type { TanakhIdentity, TalmudIdentity } from "../../types.ts";

describe("formatReference for Tanakh", () => {
  it("formats a standard verse", () => {
    const id: TanakhIdentity = { book: "Genesis", chapter: 1, verse: 1 };
    expect(formatReference(id, TANAKH_SCHEMA)).toBe("Genesis 1:1");
  });

  it("formats a multi-digit chapter", () => {
    const id: TanakhIdentity = { book: "Psalms", chapter: 119, verse: 176 };
    expect(formatReference(id, TANAKH_SCHEMA)).toBe("Psalms 119:176");
  });

  it("handles a book name with a space", () => {
    const id: TanakhIdentity = { book: "Song of Songs", chapter: 1, verse: 1 };
    expect(formatReference(id, TANAKH_SCHEMA)).toBe("Song of Songs 1:1");
  });
});

describe("formatReference for Talmud", () => {
  it("formats a standard segment with amud concatenated", () => {
    const id: TalmudIdentity = {
      tractate: "Berakhot",
      daf: 17,
      amud: "b",
      segment: 11,
    };
    expect(formatReference(id, TALMUD_SCHEMA)).toBe("Berakhot 17b:11");
  });

  it("handles a tractate name with a space", () => {
    const id: TalmudIdentity = {
      tractate: "Bava Kamma",
      daf: 2,
      amud: "a",
      segment: 3,
    };
    expect(formatReference(id, TALMUD_SCHEMA)).toBe("Bava Kamma 2a:3");
  });
});

describe("serializeToUrlHash / parseFromUrlHash for Tanakh", () => {
  it("round-trips a verse", () => {
    const id: TanakhIdentity = { book: "Genesis", chapter: 1, verse: 1 };
    const hash = serializeToUrlHash(id, TANAKH_SCHEMA);
    expect(hash).toBe("Genesis:1:1");
    const parsed = parseFromUrlHash(hash, TANAKH_SCHEMA);
    expect(parsed).toEqual(id);
  });

  it("returns null for malformed input", () => {
    expect(parseFromUrlHash("", TANAKH_SCHEMA)).toBeNull();
    expect(parseFromUrlHash("Genesis", TANAKH_SCHEMA)).toBeNull();
    expect(parseFromUrlHash("Genesis:1", TANAKH_SCHEMA)).toBeNull();
    expect(parseFromUrlHash("Genesis:1:abc", TANAKH_SCHEMA)).toBeNull();
  });
});

describe("serializeToUrlHash / parseFromUrlHash for Talmud", () => {
  it("round-trips a standard segment", () => {
    const id: TalmudIdentity = {
      tractate: "Berakhot",
      daf: 2,
      amud: "a",
      segment: 1,
    };
    const hash = serializeToUrlHash(id, TALMUD_SCHEMA);
    expect(hash).toBe("Berakhot:2a:1");
    const parsed = parseFromUrlHash(hash, TALMUD_SCHEMA);
    expect(parsed).toEqual(id);
  });

  it("round-trips with a 2-digit daf", () => {
    const id: TalmudIdentity = {
      tractate: "Shabbat",
      daf: 31,
      amud: "b",
      segment: 5,
    };
    const hash = serializeToUrlHash(id, TALMUD_SCHEMA);
    expect(hash).toBe("Shabbat:31b:5");
    expect(parseFromUrlHash(hash, TALMUD_SCHEMA)).toEqual(id);
  });

  it("round-trips with a multi-word tractate name", () => {
    const id: TalmudIdentity = {
      tractate: "Bava Kamma",
      daf: 10,
      amud: "a",
      segment: 2,
    };
    const hash = serializeToUrlHash(id, TALMUD_SCHEMA);
    expect(hash).toBe("Bava Kamma:10a:2");
    expect(parseFromUrlHash(hash, TALMUD_SCHEMA)).toEqual(id);
  });

  it("rejects a daf without an amud letter", () => {
    expect(parseFromUrlHash("Berakhot:2:1", TALMUD_SCHEMA)).toBeNull();
  });

  it("rejects an invalid amud letter", () => {
    expect(parseFromUrlHash("Berakhot:2c:1", TALMUD_SCHEMA)).toBeNull();
  });
});
