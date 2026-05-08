import { describe, it, expect } from "vitest";
import {
  walkMarkers,
  walkMarkersWithBudget,
  perekUnitCharCounts,
  stripHtml,
  stripNikkud,
  parseWholeRef,
  dafAmudToIdx,
  processTractate,
} from "../../../scripts/talmud/bundle.ts";

describe("walkMarkers", () => {
  // Real markers always carry a <big> wrap on either the marker word
  // itself or the first content word — that's the strong cue we rely on
  // to distinguish structural markers from inline Hebrew abbreviations.
  it("tags all segments after a wrapped מתני׳ marker as mishnah", () => {
    const text = [
      ["<big><strong>מתני׳</strong></big> start", "continuation"],
      ["more"],
    ];
    expect(walkMarkers(text)).toEqual([[true, true], [true]]);
  });

  it("flips to gemara on a wrapped גמ׳ marker", () => {
    const text = [
      [
        "<big><strong>מתני׳</strong></big> m1",
        "<big><strong>גמ׳</strong></big> g1",
      ],
      ["more g"],
    ];
    expect(walkMarkers(text)).toEqual([[true, false], [false]]);
  });

  it("handles multi-perek alternation with wrapped markers", () => {
    const text = [
      [
        "<big><strong>מתני׳</strong></big> m1",
        "<big><strong>גמ׳</strong></big> g1",
        "more g1",
      ],
      [
        "הדרן end",
        "<big><strong>מתני׳</strong></big> m2",
        "<big><strong>גמ׳</strong></big> g2",
      ],
    ];
    expect(walkMarkers(text)).toEqual([
      [true, false, false],
      [false, true, false],
    ]);
  });

  it("starts in gemara state (conservative default)", () => {
    expect(walkMarkers([["no marker", "here"]])).toEqual([[false, false]]);
  });

  it("requires a <big> wrap — bare unwrapped 'מתני׳' alone is NOT a marker", () => {
    // Some segments mention the abbreviation as natural Hebrew without
    // any presentational wrap. Those must NOT flip state.
    expect(
      walkMarkers([
        ["מתני׳ alone with no big wrap", "next"],
      ]),
    ).toEqual([[false, false]]);
  });

  it("ignores inline (mid-segment) marker words — they are natural Hebrew abbreviations, not structural markers", () => {
    // Real Wikisource case: Bava Metzia 6b:2 contains "מתני׳" inside a quote
    // ("Rav Hamnuna said: it's a mishnah ...") and used to falsely flip the
    // state for several dapim.
    expect(
      walkMarkers([["a real gemara segment that mentions מתני׳ in passing", "next"]]),
    ).toEqual([[false, false]]);
  });

  it("recognizes wrapped markers like <big><strong>מתני׳</strong></big>", () => {
    expect(
      walkMarkers([
        [
          "<big><strong>מתני׳</strong></big> first mishnah segment",
          "second mishnah segment",
          "<big><strong>גמ׳</strong></big> first gemara segment",
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });

  it("recognizes a marker preceded by editorial '[' (Sotah 49a:17 form)", () => {
    expect(
      walkMarkers([
        [
          "<big><strong>מתני׳</strong></big> mishnah text",
          "more mishnah",
          "[<big><strong>גמ׳</strong></big> ת״ר] starts here",
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });

  it("recognizes a marker wrapped in parens inside strong (Sotah 49b:4 form)", () => {
    expect(
      walkMarkers([
        [
          "<big><strong>מתני׳</strong></big> m1",
          "m1 cont",
          "<big><strong>(גמ׳)</strong></big> first gemara",
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });

  it("recognizes the bare leading-marker form when the first word is wrapped", () => {
    expect(
      walkMarkers([
        [
          "מתני׳ <big><strong>הכל</strong></big> מעריכין",
          "continuation",
          "גמ׳ <big><strong>ת״ר</strong></big>",
        ],
      ]),
    ).toEqual([[true, true, false]]);
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

  it("removes <img> tags including data: URIs", () => {
    const blob = "data:image/png;base64," + "A".repeat(500);
    expect(
      stripHtml(`לפני <img src="${blob}" alt="x"> אחרי`),
    ).toBe("לפני אחרי");
  });

  it("removes generic angle-bracketed tags", () => {
    expect(stripHtml('<a href="x">link</a>')).toBe("link");
    expect(stripHtml("<span class='foo'>hi</span>")).toBe("hi");
  });

  it("strips markdown link syntax", () => {
    expect(stripHtml("see [Yoma 68a](/Yoma.68a) here")).toBe(
      "see Yoma 68a here",
    );
  });

  it("leaves no leftover angle brackets on a real-world image segment", () => {
    const sample =
      'היתה גבוהה <img src="data:image/png;base64,xyz"> ויש בה הכשר';
    const out = stripHtml(sample);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("היתה");
    expect(out).toContain("הכשר");
  });
});

describe("stripNikkud", () => {
  it("removes Hebrew vowels and cantillation marks", () => {
    expect(stripNikkud("שָׁלוֹם")).toBe("שלום");
    expect(stripNikkud("בְּרֵאשִׁית")).toBe("בראשית");
  });
  it("leaves text without nikkud unchanged", () => {
    expect(stripNikkud("שלום")).toBe("שלום");
  });
});

describe("walkMarkersWithBudget", () => {
  // Simulate a tractate with one amud, one perek, where the source has
  // a real מתני׳ marker but is missing the corresponding גמ׳ marker —
  // mirrors the Avodah Zarah 22a:11 → 26a:4 bug shape on a smaller scale.
  it("force-flips a runaway mishnah run that exceeds the per-marker char cap", () => {
    // Each Hebrew "word" below is 3 chars. The marker segment carries
    // ~7 chars after stripping (the marker word + content). Subsequent
    // segments add 3 chars each. With a per-perek max-unit budget of 15
    // and slack 1.2 → cap 18, the cap fires after ~4 segments.
    const text = [
      [
        "<big><strong>מתני׳</strong></big> אבג",
        "דהו",
        "זחט",
        "יכל",
        "מנס",
        "עפצ",
        "קרש",
        "תאב",
      ],
    ];
    const perekUnitChars = [[15]];
    const perekIdxByAmud = [0];
    const result = walkMarkersWithBudget(
      text,
      perekIdxByAmud,
      perekUnitChars,
      new Map(),
    );
    // The first segment is mishnah; eventually the cap fires and the
    // tail is gemara. Don't pin the exact split point — it's sensitive
    // to the marker-word strip — but assert the shape: a mishnah
    // prefix followed by an all-false gemara tail.
    expect(result[0][0]).toBe(true);
    expect(result[0][result[0].length - 1]).toBe(false);
    const flipIdx = result[0].indexOf(false);
    expect(flipIdx).toBeGreaterThan(0);
    expect(flipIdx).toBeLessThan(text[0].length);
    for (let i = flipIdx; i < result[0].length; i++) {
      expect(result[0][i]).toBe(false);
    }
  });

  it("respects an explicit gemara marker (does not require budget exhaustion)", () => {
    const text = [
      [
        "<big><strong>מתני׳</strong></big> אבג",
        "דהו",
        "<big><strong>גמ׳</strong></big> זחט",
        "יכל",
      ],
    ];
    const result = walkMarkersWithBudget(
      text,
      [0],
      [[100]], // huge budget - we'd never hit cap
      new Map(),
    );
    expect(result[0]).toEqual([true, true, false, false]);
  });

  it("resets budget per marker so a multi-mishnah perek isn't truncated", () => {
    // Two short M runs separated by a G marker. With a generous budget
    // each M run should fit comfortably inside its own counter.
    const text = [
      [
        "<big><strong>מתני׳</strong></big> אבג",
        "דהו",
        "<big><strong>גמ׳</strong></big> זחט",
        "יכל",
        "<big><strong>מתני׳</strong></big> מנס",
        "עפצ",
        "<big><strong>גמ׳</strong></big> קרש",
      ],
    ];
    const result = walkMarkersWithBudget(text, [0], [[40, 40]], new Map());
    expect(result[0]).toEqual([true, true, false, false, true, true, false]);
  });
});

describe("perekUnitCharCounts", () => {
  it("strips nikkud and HTML before counting", () => {
    // שלום = 4 chars, בראשית = 6 chars
    const counts = perekUnitCharCounts([
      ["<big>שָׁלוֹם</big>", "בְּרֵאשִׁית"],
    ]);
    expect(counts).toEqual([[4, 6]]);
  });
});

describe("processTractate", () => {
  // Build a synthetic 4-amud tractate where perek 2 starts mid-amud.
  // amudIdx 0 (1a) → empty padding (matches Sefaria-Export convention)
  // amudIdx 1 (1b) → empty padding
  // amudIdx 2 (2a) → 5 segs in perek 0
  // amudIdx 3 (2b) → 4 segs total: segs 1-2 still in perek 0, segs 3-4 in perek 1
  // amudIdx 4 (3a) → 3 segs in perek 1
  function fakeWikisource() {
    return {
      heTitle: "מסכת בדיקה",
      text: [
        [], // 1a
        [], // 1b
        ["מתני׳ a1", "a2", "a3", "a4", "a5"], // 2a
        ["b1", "b2", "b3", "b4"], // 2b — boundary at segment 3
        ["c1", "c2", "c3"], // 3a
      ],
    };
  }
  function fakeSchema() {
    return {
      alts: {
        Chapters: {
          nodes: [
            { heTitle: "פרק א", wholeRef: "Test 2a:1-2b:2" },
            { heTitle: "פרק ב", wholeRef: "Test 2b:3-3a:3" },
          ],
        },
      },
    };
  }

  it("keeps mid-amud boundary amud in the previous perek", () => {
    const { structure } = processTractate(
      "Seder Test",
      "Test",
      fakeWikisource(),
      fakeSchema(),
    );
    // amudim are indexed from 1a (firstDaf=1)
    const amud2b = structure.amudim.find(
      (a) => a.daf === 2 && a.amud === "b",
    )!;
    expect(amud2b.perekIdx).toBe(0); // boundary amud belongs to prev perek
    expect(amud2b.perekBoundaryAt).toBe(2); // 0-indexed: segs [0..2)=perek 0, [2..)=perek 1
    const amud3a = structure.amudim.find(
      (a) => a.daf === 3 && a.amud === "a",
    )!;
    expect(amud3a.perekIdx).toBe(1);
    expect(amud3a.perekBoundaryAt).toBeUndefined();
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
