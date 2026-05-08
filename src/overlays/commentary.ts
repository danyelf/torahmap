// src/overlays/commentary.ts
import "../styles/overlays/commentary.css";
import type { Overlay, Color } from "./types.ts";
import type { TanakhIdentity, TanakhLayout, CommentaryData } from "../types.ts";
import { heatmapColor } from "../utils/color.ts";
import { fetchData } from "../constants/app.ts";

let data: CommentaryData = {};
let currentCategory = "total";
let updateCallback: (() => void) | null = null;

// Cache max values per category to avoid recalculating
let cachedMaxValues: Record<string, number> = {};
let verses: TanakhLayout[] = [];

function getCount(book: string, chapter: number, verse: number): number {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return 0;
  if (currentCategory === "total") return verseData.total;
  return verseData.categories[currentCategory] || 0;
}

function getMaxValue(): number {
  if (cachedMaxValues[currentCategory] !== undefined) {
    return cachedMaxValues[currentCategory];
  }
  let max = 0;
  for (const v of verses) {
    const count = getCount(v.book, v.chapter, v.verse);
    if (count > max) max = count;
  }
  cachedMaxValues[currentCategory] = max;
  return max;
}

export const commentaryOverlay: Overlay = {
  id: "commentary",
  name: "Commentary Density",

  async init() {
    try {
      const res = await fetchData("commentary-counts.json");
      if (!res.ok) {
        console.error(`Failed to load commentary-counts.json: ${res.status}`);
        return;
      }
      data = await res.json();
    } catch (e) {
      console.error("Failed to parse commentary-counts.json:", e);
    }
  },

  destroy() {
    // Clear cached max values (will be recalculated when overlay is re-rendered)
    cachedMaxValues = {};
    // Clear callback (to prevent stale references)
    updateCallback = null;
    // NOTE: We intentionally DO NOT reset currentCategory here. It should persist
    // across overlay switches so the user can return to their selected category.
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  getVerseColor(verse: TanakhIdentity): Color | null {
    // Store reference to verses for max calculation
    // This is a bit awkward - we'll improve this in integration
    const count = getCount(verse.book, verse.chapter, verse.verse);
    const maxValue = getMaxValue();
    return heatmapColor(count, maxValue);
  },

  renderControls(container: HTMLElement) {
    const wrapper = document.createElement("div");
    wrapper.className = "commentary-controls";
    wrapper.innerHTML = `
      <label for="category-select">Category:</label>
      <select id="category-select">
        <option value="total">All Commentary</option>
        <option value="Talmud">Talmud</option>
        <option value="Midrash">Midrash</option>
        <option value="Halakhah">Halakhah</option>
        <option value="Jewish Thought">Jewish Thought</option>
        <option value="Chasidut">Chasidut</option>
        <option value="Kabbalah">Kabbalah</option>
        <option value="Musar">Musar</option>
      </select>
    `;
    const select = wrapper.querySelector("select")!;
    select.value = currentCategory;
    select.addEventListener("change", () => {
      currentCategory = select.value;
      cachedMaxValues = {}; // Clear cache on category change
      updateCallback?.();
    });
    container.appendChild(wrapper);
  },

  renderLegend(container: HTMLElement) {
    const maxValue = getMaxValue();
    const logMax = Math.log(maxValue + 1);

    // Calculate tick values (powers of 10)
    const ticks: number[] = [0];
    let tickVal = 1;
    while (tickVal <= maxValue) {
      ticks.push(tickVal);
      tickVal *= 10;
    }
    if (ticks[ticks.length - 1] < maxValue) {
      ticks.push(maxValue);
    }

    container.innerHTML = `
      <div class="legend-gradient"></div>
      <div class="legend-ticks">
        ${ticks
          .map((val) => {
            const pos = val === 0 ? 0 : (Math.log(val + 1) / logMax) * 100;
            const label = val >= 1000 ? `${val / 1000}k` : String(val);
            return `<span class="tick" style="left: ${pos}%">${label}</span>`;
          })
          .join("")}
      </div>
    `;
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    const verseData =
      data[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
    if (!verseData) return null;
    if (currentCategory === "total") {
      return `${verseData.total} links`;
    }
    const count = verseData.categories[currentCategory];
    return count ? `${count} ${currentCategory}` : `no ${currentCategory}`;
  },

  // URL parameter uses 'cat' for brevity in shareable links,
  // while internal code uses 'category' for clarity
  getUrlParams(): Record<string, string> {
    if (currentCategory === "total") return {};
    return { cat: currentCategory };
  },

  applyUrlParams(params: URLSearchParams): void {
    const category = params.get("cat");
    if (category) {
      currentCategory = category;
      cachedMaxValues = {};
      updateCallback?.();
    }
  },

  getLinkSubtitle(verse: TanakhIdentity): string | null {
    const count = getVerseCategoryCount(verse.book, verse.chapter, verse.verse);
    if (!count) return null;

    const categoryName =
      currentCategory === "total" ? "linked texts" : `${currentCategory} links`;
    return `${count} ${categoryName}`;
  },
};

export function configure(config: { verses: TanakhLayout[] }): void {
  verses = config.verses;
  cachedMaxValues = {};
  // Reset to default state for testing
  currentCategory = "total";
}

// Get total linked texts count for a verse (used by sidebar)
export function getVerseLinkCount(
  book: string,
  chapter: number,
  verse: number,
): number | null {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  return verseData?.total ?? null;
}

// Get current category (used for Sefaria URL generation and sidebar display)
export function getCurrentCategory(): string {
  return currentCategory;
}

// Get category-specific link count for a verse (used by sidebar)
function getVerseCategoryCount(
  book: string,
  chapter: number,
  verse: number,
): number | null {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return null;
  if (currentCategory === "total") return verseData.total;
  return verseData.categories[currentCategory] ?? null;
}
