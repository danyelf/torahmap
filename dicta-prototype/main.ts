// Meaning-filter prototype — throwaway, not production code.
//
// The question: with colour fixed to the search term, exactly as multi-term
// search already works, does a Dicta-style facet column of word meanings work
// when the main output is a painted map?
//
// The model, and the only model here:
//   - One word, one colour. Five colours, so five words at once.
//   - A word's meanings are a filter and nothing else. Narrowing changes which
//     verses are painted in that word's colour. It never changes the colour.
//
// A verse belongs to a meaning when that verse's own lemma list contains it.
// That is the whole rule, and it comes from public/data/verse-lemmas.json,
// the same data the real root search uses.
//
// Everything except the readable label on each meaning is computed from the
// real corpus. The labels are hand-written; see ./glosses.ts.

import { loadTanakhStructure, loadAllVerseTexts, type VerseTexts } from "../src/verseTexts.ts";
import { computeLayout, getLayoutBounds } from "../src/layout.ts";
import { initBookData, getBookOrder } from "../src/constants/books.ts";
import {
  loadLemmaData,
  findLemmasForWord,
  getRootForStrongsNumber,
  normalizeHebrewForSearch,
  toDisplayHebrew,
} from "../src/search.ts";
import { fetchData } from "../src/constants/app.ts";
import { SEARCH_COLORS } from "../src/utils/color.ts";
import type { TanakhLayout, Bounds } from "../src/types.ts";
import { SCENARIOS, glossFor } from "./glosses.ts";

// ---------------------------------------------------------------- types

interface Sense {
  strongs: string;
  verses: Set<string>;
}

interface Term {
  id: number;
  word: string; // normalized
  colour: number; // index into the palette
  senses: Sense[]; // commonest first
  chosen: Set<string>; // which senses are ticked
  /** every verse the word occurs in, before any narrowing */
  allVerses: Set<string>;
  /** written forms actually seen — informational only, never a control */
  forms: string[];
  /** senses the lemma data offered whose root is a different word */
  discarded: string[];
}

// ---------------------------------------------------------------- state

let verses: TanakhLayout[] = [];
let bounds: Bounds = { width: 1, height: 1 };
let verseTexts: VerseTexts = {};
let wordLemmas: Record<string, string[]> = {};
let verseLemmas: Record<string, string[]> = {};
/** verse key -> normalized words, for the informational form list and snippets */
let verseWords = new Map<string, string[]>();

let terms: Term[] = [];
let nextTermId = 1;

/** verse key -> indices into `terms` that currently paint it */
let painted = new Map<string, number[]>();

// ---------------------------------------------------------------- colours

const GREY_MISS = "#333333";

function css(c: readonly [number, number, number]): string {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
}

const PALETTE = SEARCH_COLORS.map(css);
const MAX_TERMS = PALETTE.length;

// ---------------------------------------------------------------- elements

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("map");
const ctx = canvas.getContext("2d")!;
const tooltip = $("tooltip");
const mapCaption = $("map-caption");
const termsEl = $("terms");
const resultsEl = $("results");
const resultsHead = $("results-head");
const addInput = $<HTMLInputElement>("add-term");

// ---------------------------------------------------------------- boot

async function boot(): Promise<void> {
  const [torahData, texts] = await Promise.all([
    loadTanakhStructure(),
    loadAllVerseTexts(),
    loadLemmaData(),
  ]);

  verseTexts = texts;
  initBookData(torahData);
  verses = computeLayout(torahData);
  bounds = getLayoutBounds(verses);

  for (const v of verses) {
    const he = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he ?? "";
    if (!he) continue;
    verseWords.set(
      `${v.book}:${v.chapter}:${v.verse}`,
      normalizeHebrewForSearch(he).split(/\s+/).filter(Boolean)
    );
  }

  [wordLemmas, verseLemmas] = await Promise.all([
    fetchData("word-lemmas.json").then((r) => r.json()),
    fetchData("verse-lemmas.json").then((r) => r.json()),
  ]);

  reportCorpusShape();
  buildScenarioButtons();
  wireControls();
  resize();
  applyScenario(SCENARIOS[0]);
}

/** How often there is anything to choose at all. */
function reportCorpusShape(): void {
  const all = Object.values(wordLemmas);
  const single = all.filter((n) => n.length === 1).length;
  const pct = ((single / all.length) * 100).toFixed(1);
  $("corpus-stat").innerHTML =
    `Of the <b>${all.length.toLocaleString()}</b> written forms in the corpus, <b>${pct}%</b> ` +
    `carry exactly one meaning, and show no meanings control.`;
}

function buildScenarioButtons(): void {
  const host = $("scenarios");
  for (const s of SCENARIOS) {
    const b = document.createElement("button");
    b.innerHTML = `${s.label}<span class="cap">${s.caption}</span>`;
    b.addEventListener("click", () => applyScenario(s));
    host.appendChild(b);
  }
}

function wireControls(): void {
  const add = () => {
    const w = addInput.value.trim();
    if (!w) return;
    addTerm(w);
    addInput.value = "";
    render();
  };
  $("add-btn").addEventListener("click", add);
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });

  window.addEventListener("resize", () => {
    resize();
    paint();
  });

  canvas.addEventListener("mousemove", onHover);
  canvas.addEventListener("mouseleave", () => (tooltip.style.display = "none"));
}

function applyScenario(s: (typeof SCENARIOS)[number]): void {
  terms = [];
  nextTermId = 1;
  for (const t of s.terms) {
    const term = addTerm(t.word);
    if (term && t.only) {
      term.chosen = new Set(t.only.filter((x) => term.senses.some((v) => v.strongs === x)));
    }
  }
  render();
}

// ---------------------------------------------------------------- terms

function addTerm(typed: string): Term | null {
  if (terms.length >= MAX_TERMS) return null;
  const word = normalizeHebrewForSearch(typed).trim();
  if (word.length < 2) return null;

  // Which meanings could this written word be?
  const offered = findLemmasForWord(word) ?? [];

  // Strong's lists a form under meanings that are really a different word, so
  // keep only those sharing the commonest root among the candidates. ETCBC is
  // the intended replacement for this identifier; the guard is here so the
  // prototype shows a plausible column rather than a bug.
  const rootCount = new Map<string, number>();
  for (const l of offered) {
    const r = getRootForStrongsNumber(l);
    if (r) rootCount.set(r, (rootCount.get(r) ?? 0) + 1);
  }
  let mainRoot = "";
  let best = 0;
  for (const [r, n] of rootCount) {
    if (n > best) {
      best = n;
      mainRoot = r;
    }
  }
  const kept = offered.filter((l) => getRootForStrongsNumber(l) === mainRoot);
  const discarded = offered.filter((l) => !kept.includes(l));

  // A verse has a meaning when the verse's own lemma list contains it. No
  // detour through written forms — that was the bug in the first build, which
  // credited a verse to every meaning its spelling carries anywhere in the
  // corpus, and so refused to filter.
  const keptSet = new Set(kept);
  const byStrongs = new Map<string, Set<string>>();
  for (const l of kept) byStrongs.set(l, new Set());
  const allVerses = new Set<string>();
  for (const [key, nums] of Object.entries(verseLemmas)) {
    for (const n of nums) {
      if (!keptSet.has(n)) continue;
      byStrongs.get(n)!.add(key);
      allVerses.add(key);
    }
  }

  const senses: Sense[] = [...byStrongs.entries()]
    .map(([strongs, vs]) => ({ strongs, verses: vs }))
    .filter((s) => s.verses.size > 0)
    .sort((a, b) => b.verses.size - a.verses.size);

  if (senses.length === 0) return null;

  // Informational only: which spellings show up in those verses.
  const formSet = new Set<string>();
  for (const key of allVerses) {
    for (const w of verseWords.get(key) ?? []) {
      if ((wordLemmas[w] ?? []).some((s) => keptSet.has(s))) formSet.add(w);
    }
  }

  const term: Term = {
    id: nextTermId++,
    word,
    colour: terms.length % PALETTE.length,
    senses,
    chosen: new Set(senses.map((s) => s.strongs)),
    allVerses,
    forms: [...formSet],
    discarded,
  };
  terms.push(term);
  return term;
}

function removeTerm(id: number): void {
  terms = terms.filter((t) => t.id !== id);
  terms.forEach((t, i) => (t.colour = i % PALETTE.length));
  render();
}

/** The verses a term currently paints, after its meaning filter. */
function paintedVerses(t: Term): Set<string> {
  const out = new Set<string>();
  for (const s of t.senses) {
    if (!t.chosen.has(s.strongs)) continue;
    for (const k of s.verses) out.add(k);
  }
  return out;
}

// ---------------------------------------------------------------- render

function render(): void {
  painted = new Map();
  terms.forEach((t, i) => {
    for (const k of paintedVerses(t)) {
      const list = painted.get(k);
      if (list) list.push(i);
      else painted.set(k, [i]);
    }
  });
  renderTerms();
  paint();
  renderResults();
}

function renderTerms(): void {
  termsEl.innerHTML = "";

  if (terms.length === 0) {
    termsEl.innerHTML = `<div class="empty">No words. Add one, or pick a scenario above.</div>`;
    return;
  }

  for (const t of terms) {
    const card = document.createElement("div");
    card.className = "term";

    const shown = paintedVerses(t).size;
    const narrowed = shown !== t.allVerses.size;

    const head = document.createElement("div");
    head.className = "term-head";
    head.innerHTML =
      `<span class="term-swatch"></span>` +
      `<span class="term-word"></span>` +
      `<span class="term-counts"></span>` +
      `<button class="term-remove" title="remove">&times;</button>`;
    (head.querySelector(".term-swatch") as HTMLElement).style.background = PALETTE[t.colour];
    head.querySelector(".term-word")!.textContent = toDisplayHebrew(t.word);
    head.querySelector(".term-counts")!.innerHTML = narrowed
      ? `<b class="narrowed">${shown.toLocaleString()}</b> of ${t.allVerses.size.toLocaleString()} verses painted`
      : `<b>${shown.toLocaleString()}</b> verses painted`;
    head.querySelector(".term-remove")!.addEventListener("click", () => removeTerm(t.id));
    card.appendChild(head);

    // A word with one meaning gets no control at all — not an empty column,
    // not a lone ticked checkbox. The facet appears only when there is a real
    // choice to make.
    if (t.senses.length > 1) {
      const box = document.createElement("div");
      box.className = "term-senses";

      const head2 = document.createElement("div");
      head2.className = "senses-head";
      head2.innerHTML = `<span>${t.senses.length} meanings</span><span></span>`;
      const btns = head2.lastElementChild!;
      for (const [text, on] of [
        ["all", true],
        ["none", false],
      ] as const) {
        const b = document.createElement("button");
        b.textContent = text;
        b.addEventListener("click", () => {
          t.chosen = on ? new Set(t.senses.map((s) => s.strongs)) : new Set();
          render();
        });
        btns.appendChild(b);
      }
      box.appendChild(head2);

      for (const s of t.senses) {
        box.appendChild(senseRow(t, s));
      }
      card.appendChild(box);
    }

    const forms = document.createElement("div");
    forms.className = "term-forms";
    forms.textContent = `${t.forms.length} written form${t.forms.length === 1 ? "" : "s"} in these verses`;
    card.appendChild(forms);

    if (t.discarded.length > 0) {
      const n = document.createElement("div");
      n.className = "note";
      n.textContent =
        `${t.discarded.length} more meaning${t.discarded.length === 1 ? " was" : "s were"} offered and dropped ` +
        `for belonging to a different root.`;
      card.appendChild(n);
    }

    termsEl.appendChild(card);
  }

  if (terms.length >= MAX_TERMS) {
    const n = document.createElement("div");
    n.className = "note";
    n.textContent = `${MAX_TERMS} words is the limit — one per colour.`;
    termsEl.appendChild(n);
  }
}

function senseRow(t: Term, s: Sense): HTMLElement {
  const row = document.createElement("label");
  row.className = "sense-row";
  const on = t.chosen.has(s.strongs);
  if (!on) row.classList.add("off");

  const gloss = glossFor(s.strongs);
  if (gloss.note) row.title = gloss.note;

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = on;
  box.addEventListener("change", () => {
    if (box.checked) t.chosen.add(s.strongs);
    else t.chosen.delete(s.strongs);
    render();
  });

  const label = document.createElement("span");
  label.className = "label";
  label.innerHTML = `<div class="primary"></div><div class="secondary"></div>`;
  label.querySelector(".primary")!.textContent = gloss.label;
  label.querySelector(".secondary")!.textContent = `Strong's ${s.strongs}`;

  const count = document.createElement("span");
  count.className = "count";
  count.textContent = String(s.verses.size);

  row.append(box, label, count);
  return row;
}

// ---------------------------------------------------------------- map

let scale = 1;
let offsetX = 0;
let offsetY = 0;

function resize(): void {
  const wrap = canvas.parentElement!;
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  scale = Math.min(w / bounds.width, h / bounds.height) * 0.95;
  offsetX = (w - bounds.width * scale) / 2;
  offsetY = (h - bounds.height * scale) / 2;
}

function paint(): void {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, w, h);

  const size = Math.max(1, 6 * scale);

  for (const v of verses) {
    const key = `${v.book}:${v.chapter}:${v.verse}`;
    const hits = painted.get(key);
    const x = offsetX + v.x * scale;
    const y = offsetY + v.y * scale;

    if (!hits) {
      ctx.fillStyle = GREY_MISS;
      ctx.fillRect(x, y, size, size);
      continue;
    }
    // More than one word in a verse: split the square, the flat analogue of
    // the stipple the real WebGL overlay uses.
    const band = size / hits.length;
    for (let i = 0; i < hits.length; i++) {
      ctx.fillStyle = PALETTE[terms[hits[i]].colour];
      ctx.fillRect(x, y + i * band, size, Math.ceil(band));
    }
  }

  if (terms.length === 0) {
    mapCaption.textContent = "No words selected.";
    return;
  }

  const parts = terms.map((t) => {
    const shown = paintedVerses(t).size;
    const narrowed = shown !== t.allVerses.size;
    return (
      `<span class="chip" style="background:${PALETTE[t.colour]}"></span>` +
      `<b>${toDisplayHebrew(t.word)}</b> ${shown.toLocaleString()}` +
      (narrowed ? ` <span style="color:#c9a86a">(narrowed from ${t.allVerses.size.toLocaleString()})</span>` : "")
    );
  });
  mapCaption.innerHTML = parts.join(" &nbsp; ");
}

function onHover(e: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left - offsetX) / scale;
  const wy = (e.clientY - rect.top - offsetY) / scale;

  let found: TanakhLayout | null = null;
  for (const v of verses) {
    if (wx >= v.x && wx <= v.x + v.size && wy >= v.y && wy <= v.y + v.size) {
      found = v;
      break;
    }
  }
  if (!found) {
    tooltip.style.display = "none";
    return;
  }

  const key = `${found.book}:${found.chapter}:${found.verse}`;
  const hits = painted.get(key) ?? [];
  tooltip.style.display = "block";
  tooltip.style.left = `${e.clientX - rect.left + 12}px`;
  tooltip.style.top = `${e.clientY - rect.top + 12}px`;
  tooltip.textContent =
    `${found.book} ${found.chapter}:${found.verse}` +
    (hits.length ? ` — ${hits.map((i) => toDisplayHebrew(terms[i].word)).join(", ")}` : "");
}

// ---------------------------------------------------------------- results

const RESULT_CAP = 400;

function renderResults(): void {
  resultsEl.innerHTML = "";

  if (painted.size === 0) {
    resultsHead.textContent = terms.length ? "No verses match the current meanings." : "Results";
    resultsEl.innerHTML = `<div class="empty">Nothing painted.</div>`;
    return;
  }

  const order = getBookOrder();
  const byBook = new Map<string, TanakhLayout[]>();
  for (const v of verses) {
    const key = `${v.book}:${v.chapter}:${v.verse}`;
    if (!painted.has(key)) continue;
    const list = byBook.get(v.book);
    if (list) list.push(v);
    else byBook.set(v.book, [v]);
  }

  resultsHead.textContent =
    `${painted.size.toLocaleString()} verses in ${byBook.size} books, in book order` +
    (painted.size > RESULT_CAP ? ` — first ${RESULT_CAP} shown` : "") +
    ` · the emphasis inside a verse is approximate: the data records which meanings a verse contains, not which word carries them`;

  let shown = 0;
  for (const book of order) {
    const list = byBook.get(book);
    if (!list) continue;
    const head = document.createElement("div");
    head.className = "book-head";
    head.textContent = `${book} · ${list.length}`;
    resultsEl.appendChild(head);
    for (const v of list) {
      if (shown++ >= RESULT_CAP) return;
      resultsEl.appendChild(resultRow(v));
    }
  }
}

function resultRow(v: TanakhLayout): HTMLElement {
  const key = `${v.book}:${v.chapter}:${v.verse}`;
  const hits = painted.get(key) ?? [];

  const row = document.createElement("div");
  row.className = "result-row";

  const dots = document.createElement("span");
  dots.className = "dots";
  for (const i of hits) {
    const d = document.createElement("span");
    d.className = "dot";
    d.style.background = PALETTE[terms[i].colour];
    dots.appendChild(d);
  }

  const ref = document.createElement("span");
  ref.className = "ref";
  ref.textContent = `${v.book} ${v.chapter}:${v.verse}`;

  // Which chosen meanings are actually in this verse — used to decide which
  // words to emphasise. Verse-level data cannot say which word carries which
  // meaning, so a word is emphasised when its spelling could carry any chosen
  // meaning that the verse contains.
  const inVerse = new Set(verseLemmas[key] ?? []);
  const wanted = new Set<string>();
  for (const i of hits) {
    for (const s of terms[i].chosen) if (inVerse.has(s)) wanted.add(s);
  }

  const he = document.createElement("span");
  he.className = "he";
  const rawText = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he ?? "";
  for (const piece of rawText.split(/([\s־]+)/)) {
    const norm = normalizeHebrewForSearch(piece).trim();
    const isHit = norm && (wordLemmas[norm] ?? []).some((s) => wanted.has(s));
    if (isHit) {
      const m = document.createElement("mark");
      m.textContent = piece;
      he.appendChild(m);
    } else {
      he.appendChild(document.createTextNode(piece));
    }
  }

  row.append(dots, ref, he);
  return row;
}

boot().catch((err) => {
  mapCaption.textContent = `failed: ${String(err)}`;
  console.error(err);
});
