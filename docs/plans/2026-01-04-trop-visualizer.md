# Trop Visualizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a trop (cantillation marks) overlay that highlights the density/location of selected trop marks across the entire Tanakh.

**Architecture:** Extract trop marks from existing Hebrew text files (Unicode U+0591-U+05AF), build a frequency index at startup, render an adaptive visualization (binary for rare trop, heatmap for common), with a visual selection chart organized by rarity.

**Tech Stack:** TypeScript, WebGL (existing renderer), HTML/CSS controls

---

## Task 1: Define Trop Types and Constants

**Files:**
- Create: `src/trop.ts`

**Step 1: Create trop.ts with Unicode constants and type definitions**

```typescript
// Trop (cantillation marks) extraction and indexing

// Unicode range for Hebrew cantillation marks: U+0591 - U+05AF
// Reference: https://unicode.org/charts/PDF/U0590.pdf

export interface TropMark {
  unicode: string;      // The Unicode character
  codePoint: number;    // Numeric code point
  name: string;         // English name
  hebrewName: string;   // Hebrew name
}

// All 27 trop marks with their names
// Ordered by traditional grouping, will be sorted by frequency later
export const TROP_MARKS: TropMark[] = [
  // Disjunctive accents (מפסיקים) - Emperors
  { unicode: '\u0592', codePoint: 0x0592, name: 'Segol', hebrewName: 'סגול' },
  { unicode: '\u0593', codePoint: 0x0593, name: 'Shalshelet', hebrewName: 'שלשלת' },
  { unicode: '\u0594', codePoint: 0x0594, name: 'Zaqef Qatan', hebrewName: 'זקף קטן' },
  { unicode: '\u0595', codePoint: 0x0595, name: 'Zaqef Gadol', hebrewName: 'זקף גדול' },
  { unicode: '\u0596', codePoint: 0x0596, name: 'Tipcha', hebrewName: 'טפחא' },
  { unicode: '\u0597', codePoint: 0x0597, name: 'Revia', hebrewName: 'רביע' },
  { unicode: '\u0598', codePoint: 0x0598, name: 'Zarqa', hebrewName: 'זרקא' },
  { unicode: '\u0599', codePoint: 0x0599, name: 'Pashta', hebrewName: 'פשטא' },
  { unicode: '\u059A', codePoint: 0x059A, name: 'Yetiv', hebrewName: 'יתיב' },
  { unicode: '\u059B', codePoint: 0x059B, name: 'Tevir', hebrewName: 'תביר' },
  { unicode: '\u059C', codePoint: 0x059C, name: 'Geresh', hebrewName: 'גרש' },
  { unicode: '\u059D', codePoint: 0x059D, name: 'Geresh Muqdam', hebrewName: 'גרש מוקדם' },
  { unicode: '\u059E', codePoint: 0x059E, name: 'Gershayim', hebrewName: 'גרשיים' },
  { unicode: '\u059F', codePoint: 0x059F, name: 'Karnei Parah', hebrewName: 'קרני פרה' },
  { unicode: '\u05A0', codePoint: 0x05A0, name: 'Telisha Gedola', hebrewName: 'תלישא גדולה' },
  { unicode: '\u05A1', codePoint: 0x05A1, name: 'Pazer', hebrewName: 'פזר' },
  // Conjunctive accents (משרתים)
  { unicode: '\u05A3', codePoint: 0x05A3, name: 'Munach', hebrewName: 'מונח' },
  { unicode: '\u05A4', codePoint: 0x05A4, name: 'Mahapakh', hebrewName: 'מהפך' },
  { unicode: '\u05A5', codePoint: 0x05A5, name: 'Merkha', hebrewName: 'מרכא' },
  { unicode: '\u05A6', codePoint: 0x05A6, name: 'Merkha Kefula', hebrewName: 'מרכא כפולה' },
  { unicode: '\u05A7', codePoint: 0x05A7, name: 'Darga', hebrewName: 'דרגא' },
  { unicode: '\u05A8', codePoint: 0x05A8, name: 'Qadma', hebrewName: 'קדמא' },
  { unicode: '\u05A9', codePoint: 0x05A9, name: 'Telisha Qetana', hebrewName: 'תלישא קטנה' },
  { unicode: '\u05AA', codePoint: 0x05AA, name: 'Yerah Ben Yomo', hebrewName: 'ירח בן יומו' },
  { unicode: '\u05AB', codePoint: 0x05AB, name: 'Ole', hebrewName: 'עולה' },
  { unicode: '\u05AC', codePoint: 0x05AC, name: 'Iluy', hebrewName: 'אילוי' },
  { unicode: '\u05AD', codePoint: 0x05AD, name: 'Dehi', hebrewName: 'דחי' },
  { unicode: '\u05AE', codePoint: 0x05AE, name: 'Zinor', hebrewName: 'זינור' },
  // Special
  { unicode: '\u0591', codePoint: 0x0591, name: 'Etnachta', hebrewName: 'אתנחתא' },
  { unicode: '\u05A2', codePoint: 0x05A2, name: 'Atnah Hafukh', hebrewName: 'אתנח הפוך' },
  { unicode: '\u05AF', codePoint: 0x05AF, name: 'Masora Circle', hebrewName: 'עיגול מסורה' },
];

// Create lookup map by unicode character
export const TROP_BY_UNICODE: Map<string, TropMark> = new Map(
  TROP_MARKS.map(t => [t.unicode, t])
);

// Rarity thresholds
export const RARITY_THRESHOLDS = {
  RARE: 50,       // < 50 occurrences = rare
  UNCOMMON: 500,  // 50-500 = uncommon
  // > 500 = common
};

export type RarityTier = 'rare' | 'uncommon' | 'common';

export function getRarityTier(count: number): RarityTier {
  if (count < RARITY_THRESHOLDS.RARE) return 'rare';
  if (count < RARITY_THRESHOLDS.UNCOMMON) return 'uncommon';
  return 'common';
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds (file is created but not imported yet)

**Step 3: Commit**

```bash
git add src/trop.ts
git commit -s -m "feat(trop): add trop mark type definitions and constants"
```

---

## Task 2: Implement Trop Extraction from Hebrew Text

**Files:**
- Modify: `src/trop.ts`

**Step 1: Add extraction function**

Add to `src/trop.ts`:

```typescript
// Extract all trop marks from a Hebrew text string
export function extractTropMarks(hebrewText: string): string[] {
  const marks: string[] = [];
  for (const char of hebrewText) {
    const codePoint = char.codePointAt(0);
    if (codePoint && codePoint >= 0x0591 && codePoint <= 0x05AF) {
      marks.push(char);
    }
  }
  return marks;
}

// Count occurrences of each trop mark in text
export function countTropMarks(hebrewText: string): Map<string, number> {
  const counts = new Map<string, number>();
  const marks = extractTropMarks(hebrewText);
  for (const mark of marks) {
    counts.set(mark, (counts.get(mark) || 0) + 1);
  }
  return counts;
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/trop.ts
git commit -s -m "feat(trop): add trop extraction functions"
```

---

## Task 3: Build Trop Index from Verse Texts

**Files:**
- Modify: `src/trop.ts`
- Modify: `src/types.ts`

**Step 1: Add TropIndex type to types.ts**

Add to `src/types.ts`:

```typescript
// Trop index: maps trop unicode -> list of verse locations containing it
export interface TropVerseLocation {
  book: string;
  chapter: number;
  verse: number;
  count: number;  // How many times this trop appears in this verse
}

export interface TropIndexEntry {
  unicode: string;
  name: string;
  hebrewName: string;
  totalCount: number;
  verses: TropVerseLocation[];
}

export type TropIndex = Map<string, TropIndexEntry>;
```

**Step 2: Add buildTropIndex function to trop.ts**

Add to `src/trop.ts`:

```typescript
import type { TropIndex, TropIndexEntry, TropVerseLocation } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';

// Build complete trop index from all verse texts
export function buildTropIndex(verseTexts: VerseTexts): TropIndex {
  const index: TropIndex = new Map();

  // Initialize entries for all known trop marks
  for (const trop of TROP_MARKS) {
    index.set(trop.unicode, {
      unicode: trop.unicode,
      name: trop.name,
      hebrewName: trop.hebrewName,
      totalCount: 0,
      verses: [],
    });
  }

  // Scan all verses
  for (const [book, chapters] of Object.entries(verseTexts)) {
    for (const [chapterStr, verses] of Object.entries(chapters)) {
      const chapter = parseInt(chapterStr, 10);
      for (const [verseStr, text] of Object.entries(verses)) {
        const verse = parseInt(verseStr, 10);
        const counts = countTropMarks(text.he);

        for (const [unicode, count] of counts) {
          const entry = index.get(unicode);
          if (entry) {
            entry.totalCount += count;
            entry.verses.push({ book, chapter, verse, count });
          }
        }
      }
    }
  }

  return index;
}

// Get trop marks sorted by frequency (rarest first)
export function getTropByFrequency(index: TropIndex): TropIndexEntry[] {
  return Array.from(index.values())
    .filter(entry => entry.totalCount > 0)  // Only include marks that appear
    .sort((a, b) => a.totalCount - b.totalCount);
}
```

**Step 3: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/trop.ts src/types.ts
git commit -s -m "feat(trop): add trop index builder"
```

---

## Task 4: Integrate Trop Index into Main

**Files:**
- Modify: `src/main.ts`

**Step 1: Import trop functions and build index on load**

Add import at top of `src/main.ts`:

```typescript
import { buildTropIndex, getTropByFrequency, getRarityTier, TROP_BY_UNICODE } from './trop.ts';
import type { TropIndex, TropIndexEntry } from './types.ts';
```

**Step 2: Build index after loading verse texts**

In the `main()` function, after the `console.log('Divine names and commentary data loaded');` line, add:

```typescript
  // Build trop index from verse texts
  const tropIndex = buildTropIndex(verseTexts);
  const tropByFrequency = getTropByFrequency(tropIndex);
  console.log(`Built trop index: ${tropByFrequency.length} marks found`);
  console.log('Rarest trop:', tropByFrequency.slice(0, 5).map(t => `${t.name} (${t.totalCount})`).join(', '));
```

**Step 3: Verify it compiles and runs**

Run: `npm run build && npm run dev`
Expected: Console shows trop index info, rarest trop marks listed

**Step 4: Commit**

```bash
git add src/main.ts
git commit -s -m "feat(trop): integrate trop index into main, log stats"
```

---

## Task 5: Add Trop Overlay Option to HTML

**Files:**
- Modify: `index.html`

**Step 1: Add "Trop" option to overlay selector**

Find the overlay select element and add the trop option:

```html
    <select id="overlay-select">
      <option value="none">None</option>
      <option value="divine-names">Divine Names</option>
      <option value="commentary">Commentary</option>
      <option value="trop">Trop</option>
    </select>
```

**Step 2: Add trop controls container (hidden by default)**

Add after the `divine-names-legend` div:

```html
    <div id="trop-controls" style="display: none; margin-top: 10px;">
      <label style="margin-bottom: 8px;">Select Trop Mark</label>
      <div id="trop-chart" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 6px;">
        <!-- Trop buttons will be inserted here by JS -->
      </div>
      <div id="trop-info" style="margin-top: 8px; font-size: 11px; color: #888; min-height: 32px;">
        <!-- Selected trop info appears here -->
      </div>
    </div>
```

**Step 3: Add CSS for trop chart buttons**

Add to the `<style>` section:

```css
    #trop-chart button {
      width: 100%;
      aspect-ratio: 1;
      border: 1px solid #444;
      border-radius: 4px;
      background: #222;
      color: #fff;
      font-family: "SBL Hebrew", "Ezra SIL", serif;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.15s;
    }
    #trop-chart button:hover {
      border-color: #888;
      background: #333;
    }
    #trop-chart button.selected {
      border-color: #6ab0f3;
      background: #2a3f55;
    }
    #trop-chart button.rare::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 6px;
      height: 6px;
      background: #ffd700;
      border-radius: 50%;
    }
    #trop-chart button {
      position: relative;
    }
```

**Step 4: Verify HTML is valid**

Run: `npm run dev`
Expected: Page loads, "Trop" appears in overlay dropdown

**Step 5: Commit**

```bash
git add index.html
git commit -s -m "feat(trop): add trop overlay option and chart container to HTML"
```

---

## Task 6: Populate Trop Chart with Buttons

**Files:**
- Modify: `src/main.ts`

**Step 1: Add function to create trop chart**

Add this function in `src/main.ts` (before the `main()` function):

```typescript
function createTropChart(
  tropByFrequency: TropIndexEntry[],
  onSelect: (entry: TropIndexEntry | null) => void
): void {
  const chart = document.getElementById('trop-chart');
  const info = document.getElementById('trop-info');
  if (!chart) return;

  chart.innerHTML = '';
  let selectedButton: HTMLButtonElement | null = null;

  for (const entry of tropByFrequency) {
    const button = document.createElement('button');
    button.textContent = 'ב' + entry.unicode; // Show on a bet for visibility
    button.title = `${entry.name} (${entry.hebrewName})`;

    const tier = getRarityTier(entry.totalCount);
    if (tier === 'rare') {
      button.classList.add('rare');
    }

    button.addEventListener('mouseenter', () => {
      if (info) {
        const tierLabel = tier === 'rare' ? 'Rare' : tier === 'uncommon' ? 'Uncommon' : 'Common';
        info.textContent = `${entry.name} (${entry.hebrewName}) · ${entry.totalCount.toLocaleString()} occurrences · ${tierLabel}`;
      }
    });

    button.addEventListener('mouseleave', () => {
      if (info && !selectedButton) {
        info.textContent = '';
      } else if (info && selectedButton) {
        // Restore selected info
        const selEntry = tropByFrequency.find(e => e.unicode === selectedButton?.dataset.unicode);
        if (selEntry) {
          const selTier = getRarityTier(selEntry.totalCount);
          const tierLabel = selTier === 'rare' ? 'Rare' : selTier === 'uncommon' ? 'Uncommon' : 'Common';
          info.textContent = `${selEntry.name} (${selEntry.hebrewName}) · ${selEntry.totalCount.toLocaleString()} · ${tierLabel}`;
        }
      }
    });

    button.addEventListener('click', () => {
      // Toggle selection
      if (selectedButton === button) {
        button.classList.remove('selected');
        selectedButton = null;
        onSelect(null);
        if (info) info.textContent = '';
      } else {
        if (selectedButton) selectedButton.classList.remove('selected');
        button.classList.add('selected');
        selectedButton = button;
        onSelect(entry);
      }
    });

    button.dataset.unicode = entry.unicode;
    chart.appendChild(button);
  }
}
```

**Step 2: Call createTropChart in main()**

In `main()`, after creating the trop index, add:

```typescript
  // Track selected trop
  let selectedTrop: TropIndexEntry | null = null;

  // Create trop chart
  createTropChart(tropByFrequency, (entry) => {
    selectedTrop = entry;
    if (currentOverlay === 'trop') {
      applyOverlay();
      render();
    }
  });
```

**Step 3: Verify it compiles and chart appears**

Run: `npm run dev`
Expected: When selecting "Trop" overlay, chart with trop buttons appears

**Step 4: Commit**

```bash
git add src/main.ts
git commit -s -m "feat(trop): populate trop selection chart with buttons"
```

---

## Task 7: Show/Hide Trop Controls on Overlay Change

**Files:**
- Modify: `src/main.ts`

**Step 1: Add trop controls element reference**

Find the UI elements section (around line 452) and add:

```typescript
  const tropControls = document.getElementById('trop-controls');
```

**Step 2: Update overlay change handler**

In the overlay selector event listener, add handling for trop controls:

```typescript
  overlaySelect?.addEventListener('change', () => {
    currentOverlay = overlaySelect.value;

    // Show/hide controls based on overlay
    if (commentaryControls) {
      commentaryControls.style.display = currentOverlay === 'commentary' ? 'block' : 'none';
    }
    if (legend) {
      legend.style.display = currentOverlay === 'commentary' ? 'block' : 'none';
    }
    if (divineNamesLegend) {
      divineNamesLegend.style.display = currentOverlay === 'divine-names' ? 'block' : 'none';
    }
    if (tropControls) {
      tropControls.style.display = currentOverlay === 'trop' ? 'block' : 'none';
    }

    applyOverlay();
    render();
  });
```

**Step 3: Verify trop controls show/hide correctly**

Run: `npm run dev`
Expected: Selecting "Trop" shows the chart, selecting other overlays hides it

**Step 4: Commit**

```bash
git add src/main.ts
git commit -s -m "feat(trop): show/hide trop controls on overlay change"
```

---

## Task 8: Implement Trop Overlay Coloring (Adaptive by Rarity)

**Files:**
- Modify: `src/main.ts`

**Step 1: Add trop overlay case to applyOverlay()**

In the `applyOverlay()` function, add a new case for trop:

```typescript
    } else if (currentOverlay === 'trop') {
      if (!selectedTrop) {
        // No trop selected - show gray
        verses.forEach((v, i) => {
          const brightness = 0.4 + seededRandom(i * 3) * 0.4;
          v.color = [brightness, brightness, brightness];
        });
      } else {
        const tier = getRarityTier(selectedTrop.totalCount);

        // Build verse lookup for quick access
        const verseLookup = new Map<string, number>();
        for (const loc of selectedTrop.verses) {
          const key = `${loc.book}:${loc.chapter}:${loc.verse}`;
          verseLookup.set(key, loc.count);
        }

        if (tier === 'rare') {
          // Binary highlight: bright gold for matches, dim gray for non-matches
          verses.forEach((v, i) => {
            const key = `${v.book}:${v.chapter}:${v.verse}`;
            if (verseLookup.has(key)) {
              v.color = [1.0, 0.84, 0.0]; // Gold
            } else {
              v.color = [0.15, 0.15, 0.15]; // Very dim
            }
          });
        } else if (tier === 'uncommon') {
          // Gradient based on count (0 = dim, max = bright purple)
          const maxCount = Math.max(...selectedTrop.verses.map(v => v.count), 1);
          verses.forEach((v, i) => {
            const key = `${v.book}:${v.chapter}:${v.verse}`;
            const count = verseLookup.get(key) || 0;
            if (count === 0) {
              v.color = [0.12, 0.12, 0.15];
            } else {
              const t = count / maxCount;
              // Dim purple to bright purple
              v.color = [0.4 + t * 0.5, 0.2 + t * 0.2, 0.6 + t * 0.35];
            }
          });
        } else {
          // Common: full heatmap like commentary
          const maxCount = Math.max(...selectedTrop.verses.map(v => v.count), 1);
          verses.forEach((v, i) => {
            const key = `${v.book}:${v.chapter}:${v.verse}`;
            const count = verseLookup.get(key) || 0;
            // Reuse heatmap color function with purple tint
            if (count === 0) {
              v.color = [0.12, 0.1, 0.15];
            } else {
              const logMax = Math.log(maxCount + 1);
              const t = Math.log(count + 1) / logMax;
              // Purple spectrum: dark purple -> purple -> magenta -> pink
              if (t < 0.33) {
                const s = t / 0.33;
                v.color = [0.2 + s * 0.2, 0.1 + s * 0.1, 0.3 + s * 0.2];
              } else if (t < 0.66) {
                const s = (t - 0.33) / 0.33;
                v.color = [0.4 + s * 0.3, 0.2 + s * 0.1, 0.5 + s * 0.2];
              } else {
                const s = (t - 0.66) / 0.34;
                v.color = [0.7 + s * 0.25, 0.3 + s * 0.3, 0.7 + s * 0.2];
              }
            }
          });
        }
      }
    }
```

**Step 2: Verify trop overlay works**

Run: `npm run dev`
Expected:
- Selecting trop overlay with no trop selected shows gray
- Selecting a rare trop shows bright gold dots on dim background
- Selecting common trop shows purple heatmap

**Step 3: Commit**

```bash
git add src/main.ts
git commit -s -m "feat(trop): implement adaptive trop overlay coloring"
```

---

## Task 9: Highlight Selected Trop in Sidebar Hebrew Text

**Files:**
- Modify: `src/main.ts`

**Step 1: Create function to highlight trop in Hebrew text**

Add this function before `updateSidebar`:

```typescript
function highlightTropInText(hebrewText: string, tropUnicode: string): string {
  // Wrap the trop mark in a span for highlighting
  // The trop is a combining character, so we highlight it with its base letter
  const result: string[] = [];
  let i = 0;

  while (i < hebrewText.length) {
    const char = hebrewText[i];
    const codePoint = char.codePointAt(0) || 0;

    // Check if this is the target trop mark
    if (char === tropUnicode) {
      // Find the base letter (previous non-combining character)
      // Wrap from the last base letter through this trop
      if (result.length > 0) {
        // Pop characters back to the base letter
        const highlighted: string[] = [];
        while (result.length > 0) {
          const last = result[result.length - 1];
          const lastCode = last.codePointAt(0) || 0;
          // Keep popping combining characters
          if (lastCode >= 0x0591 && lastCode <= 0x05C7) {
            highlighted.unshift(result.pop()!);
          } else {
            // This is the base letter
            highlighted.unshift(result.pop()!);
            break;
          }
        }
        highlighted.push(char);
        result.push(`<mark class="trop-highlight">${highlighted.join('')}</mark>`);
      } else {
        result.push(`<mark class="trop-highlight">${char}</mark>`);
      }
    } else {
      result.push(char);
    }
    i++;
  }

  return result.join('');
}
```

**Step 2: Update updateSidebar to use highlighting when trop overlay is active**

Modify the `updateSidebar` function where it sets the Hebrew text:

```typescript
    if (sidebarHebrew) {
      const hebrewText = text?.he || 'Loading...';
      if (currentOverlay === 'trop' && selectedTrop) {
        sidebarHebrew.innerHTML = highlightTropInText(hebrewText, selectedTrop.unicode);
      } else {
        sidebarHebrew.textContent = hebrewText;
      }
    }
```

**Step 3: Add CSS for trop highlight in index.html**

Add to the `<style>` section:

```css
    .trop-highlight {
      background: rgba(255, 215, 0, 0.3);
      border-radius: 2px;
      padding: 0 1px;
    }
```

**Step 4: Verify highlighting works**

Run: `npm run dev`
Expected: When trop overlay is active and a verse is selected, the chosen trop mark is highlighted in yellow in the sidebar

**Step 5: Commit**

```bash
git add src/main.ts index.html
git commit -s -m "feat(trop): highlight selected trop in sidebar Hebrew text"
```

---

## Task 10: Add Hover Info for Trop Overlay

**Files:**
- Modify: `src/main.ts`

**Step 1: Update hover info display for trop overlay**

In the mousemove handler that updates `hoverInfo`, add a case for trop:

Find the section that starts with `if (currentOverlay === 'divine-names')` and add after the commentary case:

```typescript
          } else if (currentOverlay === 'trop' && selectedTrop) {
            const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
            const loc = selectedTrop.verses.find(
              v => v.book === verse.book && v.chapter === verse.chapter && v.verse === verse.verse
            );
            if (loc) {
              info += ` (${selectedTrop.name} ×${loc.count})`;
            }
          }
```

**Step 2: Verify hover info shows trop count**

Run: `npm run dev`
Expected: Hovering over a verse in trop mode shows the trop name and count

**Step 3: Commit**

```bash
git add src/main.ts
git commit -s -m "feat(trop): show trop info on verse hover"
```

---

## Task 11: Final Build and Test

**Files:**
- None (verification only)

**Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Test all functionality**

Run: `npm run dev`

Manual test checklist:
- [ ] "Trop" appears in overlay dropdown
- [ ] Selecting "Trop" shows the trop chart
- [ ] Trop chart shows buttons ordered by rarity (rarest first)
- [ ] Rare trop buttons have gold indicator dot
- [ ] Hovering trop button shows name, count, rarity
- [ ] Clicking trop button selects it (highlighted)
- [ ] Clicking selected trop deselects it
- [ ] Rare trop shows gold dots on dark background
- [ ] Common trop shows purple heatmap
- [ ] Clicking verse in trop mode shows sidebar
- [ ] Selected trop is highlighted in Hebrew text in sidebar
- [ ] Hover info shows trop count

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -s -m "feat(trop): complete trop visualizer implementation"
```

---

## Summary

This plan implements the trop visualizer in 11 tasks:

1. Define trop types and constants
2. Implement trop extraction from Hebrew text
3. Build trop index from verse texts
4. Integrate trop index into main
5. Add trop overlay option to HTML
6. Populate trop chart with buttons
7. Show/hide trop controls on overlay change
8. Implement adaptive trop overlay coloring
9. Highlight selected trop in sidebar
10. Add hover info for trop overlay
11. Final build and test

Each task is self-contained with clear steps, verification, and commits.
