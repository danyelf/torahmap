// Faceted-search prototype — throwaway, not production code.
//
// The question this page exists to answer: does Dicta's two-column facet
// interface (word senses on one side, written forms on the other) make sense
// when the main thing a search produces is a painted map rather than a list?
//
// It reuses the real corpus and the real lemma files. The only invented part
// is the human-readable label on each sense; see ./glosses.ts.

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
import { DEMO_WORDS, glossFor } from "./glosses.ts";

// ---------------------------------------------------------------- types

type PaintMode = "filter" | "colour-meaning" | "colour-form" | "emphasise";

interface VerseWords {
  layout: TanakhLayout;
  key: string;
  words: string[]; // normalized
}

interface Facet {
  id: string; // strongs number, or normalized written form
  verses: Set<string>;
}

// ---------------------------------------------------------------- state

let verses: TanakhLayout[] = [];
let bounds: Bounds = { width: 1, height: 1 };
let verseWords: VerseWords[] = [];
let verseTexts: VerseTexts = {};
let wordLemmas: Record<string, string[]> = {};
let strongsToForms = new Map<string, Set<string>>();
/** verse key -> the Strong's number of every word in that verse, in word order */
let verseLemmas: Record<string, string[]> = {};
/** senses the typed word could be, but whose root is a different word */
let discardedSenses: string[] = [];

/** verse key -> the written forms in that verse that matched the query */
let hitsByVerse = new Map<string, Set<string>>();
let meaningFacets: Facet[] = [];
let formFacets: Facet[] = [];
/** normalized written form -> the senses it could belong to (within this query) */
let formToMeanings = new Map<string, string[]>();

const selectedMeanings = new Set<string>();
const selectedForms = new Set<string>();

let paintMode: PaintMode = "filter";
let currentQuery = "";

// verse key -> [active?, meaning index, form index]
let paintPlan = new Map<string, { meaning: number; form: number }>();

// ---------------------------------------------------------------- colours

const GREY_MISS = "#333333";
const GREY_FILTERED = "#2a2a2a";
const DIMMED_HIT = "#6b5c33";
const SINGLE_HIT = "#e8a33d";

function css(c: readonly [number, number, number]): string {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
}

const PALETTE = SEARCH_COLORS.map(css);

// ---------------------------------------------------------------- elements

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("map");
const ctx = canvas.getContext("2d")!;
const tooltip = $("tooltip");
const mapCaption = $("map-caption");
const meaningsEl = $("meanings");
const formsEl = $("forms");
const meaningsSub = $("meanings-sub");
const formsSub = $("forms-sub");
const resultsEl = $("results");
const resultsHead = $("results-head");
const queryEl = $<HTMLInputElement>("query");

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

  // Our own word index. The real search index does the same job, but it
  // reports a verse hit without telling us which written form caused it,
  // and the written form is exactly what a facet column is made of.
  for (const v of verses) {
    const he = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he ?? "";
    if (!he) continue;
    verseWords.push({
      layout: v,
      key: `${v.book}:${v.chapter}:${v.verse}`,
      words: normalizeHebrewForSearch(he).split(/\s+/).filter(Boolean),
    });
  }

  [wordLemmas, verseLemmas] = await Promise.all([
    fetchData("word-lemmas.json").then((r) => r.json()),
    fetchData("verse-lemmas.json").then((r) => r.json()),
  ]);
  for (const [form, nums] of Object.entries(wordLemmas)) {
    for (const n of nums) {
      let set = strongsToForms.get(n);
      if (!set) strongsToForms.set(n, (set = new Set()));
      set.add(form);
    }
  }

  reportCorpusShape();
  buildDemoButtons();
  wireControls();
  resize();
  runQuery(queryEl.value);
}

/**
 * How long would these two columns actually be? Measured over the real
 * corpus, not asserted. This is the number that decides whether the
 * interface earns its space.
 */
function reportCorpusShape(): void {
  const forms = Object.values(wordLemmas);
  const single = forms.filter((n) => n.length === 1).length;
  const pctSingle = ((single / forms.length) * 100).toFixed(1);

  const sizes = [...strongsToForms.values()].map((s) => s.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const max = sizes[sizes.length - 1];

  $("corpus-stat").innerHTML =
    `Across all <b>${forms.length.toLocaleString()}</b> written forms in the corpus, ` +
    `<b>${pctSingle}%</b> have exactly one sense — so the Meanings column is usually one row. ` +
    `A sense has a median of <b>${median}</b> written forms and at most <b>${max}</b>.`;
}

function buildDemoButtons(): void {
  const host = $("demo-words");
  for (const d of DEMO_WORDS) {
    const b = document.createElement("button");
    b.innerHTML = `${d.word}<span class="cap">${d.caption}</span>`;
    b.addEventListener("click", () => {
      queryEl.value = d.word;
      runQuery(d.word);
    });
    host.appendChild(b);
  }
}

function wireControls(): void {
  queryEl.addEventListener("input", () => runQuery(queryEl.value));

  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      paintMode = r.value as PaintMode;
      recompute();
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-all], [data-none]").forEach((b) => {
    b.addEventListener("click", () => {
      const which = b.dataset.all ?? b.dataset.none;
      const on = b.dataset.all !== undefined;
      const [set, facets] =
        which === "meanings"
          ? ([selectedMeanings, meaningFacets] as const)
          : ([selectedForms, formFacets] as const);
      set.clear();
      if (on) for (const f of facets) set.add(f.id);
      recompute();
    });
  });

  window.addEventListener("resize", () => {
    resize();
    paint();
  });

  canvas.addEventListener("mousemove", onHover);
  canvas.addEventListener("mouseleave", () => (tooltip.style.display = "none"));
}

// ---------------------------------------------------------------- query

function runQuery(typed: string): void {
  currentQuery = normalizeHebrewForSearch(typed).trim();

  hitsByVerse = new Map();
  meaningFacets = [];
  formFacets = [];
  formToMeanings = new Map();
  discardedSenses = [];
  selectedMeanings.clear();
  selectedForms.clear();

  if (currentQuery.length < 2) {
    render();
    return;
  }

  // 1. Which senses could the typed word be?
  const candidateSenses = findLemmasForWord(currentQuery) ?? [];

  // Strong's is noisy in one way that matters here: a written form that is
  // really a different word gets listed anyway, so `על` comes back as a
  // possible spelling of six unrelated senses. Keep only the senses sharing
  // the commonest root among the candidates — that is what a reader means by
  // "this word".
  const rootCount = new Map<string, number>();
  for (const l of candidateSenses) {
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
  const lemmas = candidateSenses.filter((l) => getRootForStrongsNumber(l) === mainRoot);
  discardedSenses = candidateSenses.filter((l) => !lemmas.includes(l));
  const lemmaSet = new Set(lemmas);

  // 2. Which verses actually use one of those senses? This comes from the
  //    per-verse lemma list — the same data the real root search uses.
  const senseVerses = new Map<string, Set<string>>();
  for (const l of lemmas) senseVerses.set(l, new Set());
  const hitVerses = new Set<string>();
  for (const [key, nums] of Object.entries(verseLemmas)) {
    for (const n of nums) {
      if (!lemmaSet.has(n)) continue;
      senseVerses.get(n)!.add(key);
      hitVerses.add(key);
    }
  }

  // 3. Which written form did the reader actually see in each of those verses?
  const formVerses = new Map<string, Set<string>>();
  for (const vw of verseWords) {
    if (!hitVerses.has(vw.key)) continue;
    const versesSenses = new Set(verseLemmas[vw.key] ?? []);
    for (const w of vw.words) {
      const senses = (wordLemmas[w] ?? []).filter(
        (s) => lemmaSet.has(s) && versesSenses.has(s)
      );
      if (senses.length === 0) continue;
      const prev = formToMeanings.get(w) ?? [];
      formToMeanings.set(w, [...new Set([...prev, ...senses])]);
      let set = hitsByVerse.get(vw.key);
      if (!set) hitsByVerse.set(vw.key, (set = new Set()));
      set.add(w);
      let fv = formVerses.get(w);
      if (!fv) formVerses.set(w, (fv = new Set()));
      fv.add(vw.key);
    }
  }

  // 4. Word-form facets, commonest first.
  formFacets = [...formVerses.entries()]
    .map(([id, vs]) => ({ id, verses: vs }))
    .sort((a, b) => b.verses.size - a.verses.size);

  // 5. Sense facets, restricted to verses we could attach a written form to.
  //    A form that could be two senses counts toward both, so these sets
  //    overlap and the counts do not add up to the total.
  meaningFacets = [...senseVerses.entries()]
    .map(([id, vs]) => ({
      id,
      verses: new Set([...vs].filter((k) => hitsByVerse.has(k))),
    }))
    .filter((f) => f.verses.size > 0)
    .sort((a, b) => b.verses.size - a.verses.size);

  for (const f of meaningFacets) selectedMeanings.add(f.id);
  for (const f of formFacets) selectedForms.add(f.id);

  recompute();
}

function recompute(): void {
  paintPlan = new Map();
  const meaningIndex = new Map(meaningFacets.map((f, i) => [f.id, i]));
  const formIndex = new Map(formFacets.map((f, i) => [f.id, i]));

  for (const [key, forms] of hitsByVerse) {
    let bestForm = -1;
    let bestMeaning = -1;
    for (const f of forms) {
      if (!selectedForms.has(f)) continue;
      const senses = (formToMeanings.get(f) ?? []).filter((s) => selectedMeanings.has(s));
      if (senses.length === 0) continue;
      const fi = formIndex.get(f) ?? 0;
      const mi = Math.min(...senses.map((s) => meaningIndex.get(s) ?? 99));
      if (bestForm === -1 || fi < bestForm) bestForm = fi;
      if (bestMeaning === -1 || mi < bestMeaning) bestMeaning = mi;
    }
    if (bestForm !== -1) paintPlan.set(key, { meaning: bestMeaning, form: bestForm });
  }

  render();
}

// ---------------------------------------------------------------- render

function render(): void {
  renderFacets();
  paint();
  renderResults();
}

function colourForVerse(key: string): string {
  const plan = paintPlan.get(key);
  if (!plan) {
    return hitsByVerse.has(key)
      ? paintMode === "emphasise"
        ? DIMMED_HIT
        : GREY_FILTERED
      : GREY_MISS;
  }
  switch (paintMode) {
    case "colour-meaning":
      return PALETTE[plan.meaning % PALETTE.length];
    case "colour-form":
      return PALETTE[plan.form % PALETTE.length];
    default:
      return SINGLE_HIT;
  }
}

function facetSwatch(kind: "meaning" | "form", index: number): string {
  if (paintMode === "colour-meaning" && kind === "meaning") return PALETTE[index % PALETTE.length];
  if (paintMode === "colour-form" && kind === "form") return PALETTE[index % PALETTE.length];
  return "#444";
}

function renderFacets(): void {
  meaningsEl.innerHTML = "";
  formsEl.innerHTML = "";

  meaningsSub.textContent =
    meaningFacets.length === 0
      ? "no sense data for this word"
      : `${meaningFacets.length} sense${meaningFacets.length === 1 ? "" : "s"} · labels are invented`;
  formsSub.textContent =
    formFacets.length === 0 ? "—" : `${formFacets.length} written form${formFacets.length === 1 ? "" : "s"} in the corpus`;

  if (meaningFacets.length === 0 && formFacets.length === 0) {
    meaningsEl.innerHTML = `<div class="empty">Nothing to show. Type a Hebrew word, or use a demo button.</div>`;
    return;
  }

  if (meaningFacets.length === 1) {
    const note = document.createElement("div");
    note.className = "facet-note";
    note.textContent =
      "One row. This is the ordinary case — most Hebrew words carry a single sense, so this whole column collapses to a checkbox that does nothing.";
    meaningsEl.appendChild(note);
  }

  if (paintMode === "colour-meaning" && meaningFacets.length > PALETTE.length) {
    const note = document.createElement("div");
    note.className = "facet-note";
    note.textContent =
      `${meaningFacets.length} senses, ${PALETTE.length} colours. The swatches below start repeating at row ${PALETTE.length + 1}, ` +
      `so on the map "${glossFor(meaningFacets[0].id).label}" and "${glossFor(meaningFacets[PALETTE.length].id).label}" are the same colour. ` +
      `The list can say what the map cannot.`;
    meaningsEl.appendChild(note);
  }

  const tiny = meaningFacets.filter((f) => f.verses.size < 20).length;
  if (tiny > 0 && meaningFacets.length > 1) {
    const note = document.createElement("div");
    note.className = "facet-note";
    note.textContent =
      `${tiny} of these ${meaningFacets.length} senses occur in fewer than 20 verses. ` +
      `At full-Tanakh zoom that is a handful of pixels — visible in the list, effectively invisible on the map.`;
    meaningsEl.appendChild(note);
  }

  if (discardedSenses.length > 0) {
    const note = document.createElement("div");
    note.className = "facet-note";
    note.textContent =
      `${discardedSenses.length} further sense${discardedSenses.length === 1 ? " was" : "s were"} ` +
      `offered by the lemma data and dropped, because ${discardedSenses.length === 1 ? "its root is" : "their roots are"} ` +
      `a different word (${discardedSenses.map((s) => toDisplayHebrew(getRootForStrongsNumber(s) ?? s)).join(", ")}). ` +
      `Left in, the column fills with rows a reader would not recognise.`;
    meaningsEl.appendChild(note);
  }

  meaningFacets.forEach((f, i) => {
    const gloss = glossFor(f.id);
    const root = getRootForStrongsNumber(f.id);
    meaningsEl.appendChild(
      facetRow({
        checked: selectedMeanings.has(f.id),
        swatch: facetSwatch("meaning", i),
        primary: gloss.label,
        secondary: `${root ? toDisplayHebrew(root) + " · " : ""}Strong's ${f.id}`,
        title: gloss.note ?? "",
        count: f.verses.size,
        invented: true,
        onToggle: (on) => {
          on ? selectedMeanings.add(f.id) : selectedMeanings.delete(f.id);
          recompute();
        },
      })
    );
  });

  formFacets.forEach((f, i) => {
    const senses = formToMeanings.get(f.id) ?? [];
    formsEl.appendChild(
      facetRow({
        checked: selectedForms.has(f.id),
        swatch: facetSwatch("form", i),
        primary: toDisplayHebrew(f.id),
        secondary:
          senses.length > 1 ? `could be ${senses.length} of the senses above` : "",
        title: "",
        count: f.verses.size,
        hebrew: true,
        onToggle: (on) => {
          on ? selectedForms.add(f.id) : selectedForms.delete(f.id);
          recompute();
        },
      })
    );
  });
}

function facetRow(o: {
  checked: boolean;
  swatch: string;
  primary: string;
  secondary: string;
  title: string;
  count: number;
  hebrew?: boolean;
  invented?: boolean;
  onToggle: (on: boolean) => void;
}): HTMLElement {
  const row = document.createElement("label");
  row.className = "facet-row";
  if (o.hebrew) row.classList.add("hebrew");
  if (o.invented) row.classList.add("invented");
  if (!o.checked) row.classList.add("off");
  if (o.title) row.title = o.title;

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = o.checked;
  box.addEventListener("change", () => o.onToggle(box.checked));

  const sw = document.createElement("span");
  sw.className = "swatch";
  sw.style.background = o.swatch;

  const label = document.createElement("span");
  label.className = "label";
  label.innerHTML =
    `<div class="primary"></div>` + (o.secondary ? `<div class="secondary"></div>` : "");
  label.querySelector(".primary")!.textContent = o.primary;
  if (o.secondary) label.querySelector(".secondary")!.textContent = o.secondary;

  const count = document.createElement("span");
  count.className = "count";
  count.textContent = String(o.count);

  row.append(box, sw, label, count);
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

  const s = Math.max(1, 6 * scale);
  for (const vw of verseWords) {
    ctx.fillStyle = colourForVerse(vw.key);
    ctx.fillRect(offsetX + vw.layout.x * scale, offsetY + vw.layout.y * scale, s, s);
  }

  const lit = paintPlan.size;
  const allHits = hitsByVerse.size;
  mapCaption.innerHTML = currentQuery
    ? `<b>${lit.toLocaleString()}</b> verses painted of <b>${allHits.toLocaleString()}</b> that contain the word` +
      (lit === allHits ? "" : ` · ${(allHits - lit).toLocaleString()} hidden by the facets`)
    : "type a Hebrew word";
}

function onHover(e: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left - offsetX) / scale;
  const wy = (e.clientY - rect.top - offsetY) / scale;

  let found: VerseWords | null = null;
  for (const vw of verseWords) {
    const v = vw.layout;
    if (wx >= v.x && wx <= v.x + v.size && wy >= v.y && wy <= v.y + v.size) {
      found = vw;
      break;
    }
  }

  if (!found) {
    tooltip.style.display = "none";
    return;
  }
  const forms = [...(hitsByVerse.get(found.key) ?? [])].map(toDisplayHebrew);
  tooltip.style.display = "block";
  tooltip.style.left = `${e.clientX - rect.left + 12}px`;
  tooltip.style.top = `${e.clientY - rect.top + 12}px`;
  tooltip.textContent =
    `${found.layout.book} ${found.layout.chapter}:${found.layout.verse}` +
    (forms.length ? ` — ${forms.join(", ")}` : "");
}

// ---------------------------------------------------------------- results

const RESULT_CAP = 400;

function renderResults(): void {
  resultsEl.innerHTML = "";

  if (paintPlan.size === 0) {
    resultsHead.textContent = currentQuery ? "No verses match the current facets." : "Results";
    resultsEl.innerHTML = `<div class="empty">Nothing selected.</div>`;
    return;
  }

  const order = getBookOrder();
  const byBook = new Map<string, VerseWords[]>();
  for (const vw of verseWords) {
    if (!paintPlan.has(vw.key)) continue;
    let list = byBook.get(vw.layout.book);
    if (!list) byBook.set(vw.layout.book, (list = []));
    list.push(vw);
  }

  resultsHead.textContent =
    `${paintPlan.size.toLocaleString()} verses in ${byBook.size} books, in book order` +
    (paintPlan.size > RESULT_CAP ? ` — first ${RESULT_CAP} shown` : "");

  let shown = 0;
  for (const book of order) {
    const list = byBook.get(book);
    if (!list) continue;
    const head = document.createElement("div");
    head.className = "book-head";
    head.textContent = `${book} · ${list.length}`;
    resultsEl.appendChild(head);

    for (const vw of list) {
      if (shown++ >= RESULT_CAP) return;
      resultsEl.appendChild(resultRow(vw));
    }
  }
}

function resultRow(vw: VerseWords): HTMLElement {
  const row = document.createElement("div");
  row.className = "result-row";

  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = colourForVerse(vw.key);

  const ref = document.createElement("span");
  ref.className = "ref";
  ref.textContent = `${vw.layout.book} ${vw.layout.chapter}:${vw.layout.verse}`;

  const he = document.createElement("span");
  he.className = "he";
  const raw = verseTexts[vw.layout.book]?.[String(vw.layout.chapter)]?.[String(vw.layout.verse)]?.he ?? "";
  const hit = hitsByVerse.get(vw.key) ?? new Set<string>();
  for (const piece of raw.split(/([\s־]+)/)) {
    const norm = normalizeHebrewForSearch(piece).trim();
    if (norm && hit.has(norm) && selectedForms.has(norm)) {
      const m = document.createElement("mark");
      m.textContent = piece;
      he.appendChild(m);
    } else {
      he.appendChild(document.createTextNode(piece));
    }
  }

  row.append(dot, ref, he);
  return row;
}

boot().catch((err) => {
  mapCaption.textContent = `failed: ${String(err)}`;
  console.error(err);
});
