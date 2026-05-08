import { describe, it, expect } from "vitest";
import { talmudFormat } from "../../talmud/format.ts";

describe("talmudFormat", () => {
  describe("format", () => {
    it("renders a Talmud reference", () => {
      const id = {
        tractate: "Berakhot",
        daf: 17,
        amud: "b" as const,
        segment: 11,
      };
      expect(talmudFormat.format(id)).toBe("Berakhot 17b:11");
    });
  });

  describe("serializeHash", () => {
    it("produces a URL-safe hash", () => {
      const id = {
        tractate: "Berakhot",
        daf: 2,
        amud: "a" as const,
        segment: 1,
      };
      expect(talmudFormat.serializeHash(id)).toBe("Berakhot:2a:1");
    });
  });

  describe("parseHash", () => {
    it("parses a valid hash", () => {
      expect(talmudFormat.parseHash("Berakhot:2a:1")).toEqual({
        tractate: "Berakhot",
        daf: 2,
        amud: "a",
        segment: 1,
      });
    });

    it("parses a 'b' amud", () => {
      expect(talmudFormat.parseHash("Sukkah:4b:8")).toEqual({
        tractate: "Sukkah",
        daf: 4,
        amud: "b",
        segment: 8,
      });
    });

    it("returns null for an empty string", () => {
      expect(talmudFormat.parseHash("")).toBeNull();
    });

    it("returns null for missing parts", () => {
      expect(talmudFormat.parseHash("Berakhot:2a")).toBeNull();
    });

    it("returns null for invalid amud", () => {
      expect(talmudFormat.parseHash("Berakhot:2c:1")).toBeNull();
    });

    it("returns null for non-numeric daf", () => {
      expect(talmudFormat.parseHash("Berakhot:xa:1")).toBeNull();
    });

    it("returns null for non-numeric segment", () => {
      expect(talmudFormat.parseHash("Berakhot:2a:x")).toBeNull();
    });

    it("returns null for empty tractate", () => {
      expect(talmudFormat.parseHash(":2a:1")).toBeNull();
    });
  });
});
