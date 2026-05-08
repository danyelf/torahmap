import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTractateText, resetTalmudDataCache, isSegmentMishnah } from "../../talmud/data.ts";
import type { TalmudStructure } from "../../talmud/data.ts";

const fakeTractate = {
  name: "Berakhot",
  amudim: [["segment 1", "segment 2"], ["segment 3"]],
};

describe("getTractateText", () => {
  beforeEach(() => {
    resetTalmudDataCache();
    global.fetch = vi.fn(async (url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("Berakhot.json")) {
        return new Response(JSON.stringify(fakeTractate));
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
  });

  it("fetches and returns a tractate text on first call", async () => {
    const result = await getTractateText("Berakhot");
    expect(result).toEqual(fakeTractate);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("caches the result on subsequent calls", async () => {
    await getTractateText("Berakhot");
    await getTractateText("Berakhot");
    await getTractateText("Berakhot");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent in-flight fetches", async () => {
    const [a, b, c] = await Promise.all([
      getTractateText("Berakhot"),
      getTractateText("Berakhot"),
      getTractateText("Berakhot"),
    ]);
    expect(a).toEqual(fakeTractate);
    expect(b).toEqual(fakeTractate);
    expect(c).toEqual(fakeTractate);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries fetch after a previous rejection (does not poison cache)", async () => {
    resetTalmudDataCache();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "Berakhot", amudim: [["x"]] }), {
          status: 200,
        }),
      );

    await expect(getTractateText("Berakhot")).rejects.toThrow();
    const result = await getTractateText("Berakhot");
    expect(result.name).toBe("Berakhot");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("isSegmentMishnah", () => {
  const structure: TalmudStructure = {
    tractates: [
      {
        name: "Berakhot",
        hebrewName: "ברכות",
        seder: "Seder Zeraim",
        firstDaf: 2,
        amudim: [
          { daf: 2, amud: "a", segmentCount: 3, perekIdx: 0, mishnahMask: [true, true, false] },
          { daf: 2, amud: "b", segmentCount: 2, perekIdx: 0, mishnahMask: [false, false] },
        ],
        perakim: [
          { hebrewName: "פרק א", startAmudIdx: 0, endAmudIdx: 1, startSegmentInFirstAmud: 1, endSegmentInLastAmud: 2 },
        ],
      },
    ],
  };

  it("returns true for a Mishnah segment", () => {
    expect(isSegmentMishnah(structure, "Berakhot", 2, "a", 1)).toBe(true);
    expect(isSegmentMishnah(structure, "Berakhot", 2, "a", 2)).toBe(true);
  });

  it("returns false for a Gemara segment", () => {
    expect(isSegmentMishnah(structure, "Berakhot", 2, "a", 3)).toBe(false);
    expect(isSegmentMishnah(structure, "Berakhot", 2, "b", 1)).toBe(false);
  });

  it("returns false for an unknown tractate", () => {
    expect(isSegmentMishnah(structure, "Nonexistent", 2, "a", 1)).toBe(false);
  });

  it("returns false for an out-of-range daf", () => {
    expect(isSegmentMishnah(structure, "Berakhot", 99, "a", 1)).toBe(false);
  });
});
