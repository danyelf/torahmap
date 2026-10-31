// The map's labels: each book's name at its top-right (top-left in a text read
// left to right), and each section's name set sideways beside it. On the
// Talmud's map a book is a tractate and a section a seder.

import { HEBREW_LABEL_FONT, HEBREW_LABEL_SCALE } from './labelTypography.ts';

interface Pan {
  x: number;
  y: number;
}

/** A section's name, in Hebrew and in English. */
export interface SectionName {
  he: string;
  en: string;
}

/** The left and right edges of some squares, and their top. */
interface Box {
  minX: number;
  maxX: number;
  minY: number;
}

/** A book, its section, and the box of its squares. */
export interface BookBox extends Box {
  name: string;
  hebrewName: string;
  section: string;
}

const BASE_LABEL_GAP = 10; // Gap between label bottom and verse top at BASE_FONT_SIZE
const BASE_FONT_SIZE = 13; // Font size at zoom=1
const MIN_FONT_SIZE = 5; // Minimum font size when zoomed out
const MAX_FONT_SIZE = 50; // Maximum font size when zoomed in
// Below this screen width a book is too narrow for its English name as well.
const ENGLISH_MIN_BOOK_WIDTH_PX = 80;

/**
 * A text's section labels: their font size at zoom 1, and the gap between a
 * section and its label, in ems.
 *
 * The font has no minimum, so a label keeps its length on the map, and a text
 * picks a size at which its longest label is shorter than its shortest
 * section: then however far out the reader zooms, no label reaches the next
 * section.
 */
export interface SectionLabelSize {
  fontSize: number;
  gapEm: number;
}

const MAX_SECTION_FONT_SIZE = 64;
export const SECTION_LABEL_LINE_EM = 1.2;
const BOOK_LABEL_LINE_EM = 1.2;

/**
 * How far from its section a section label reaches, in map units, while
 * its font is still growing with the zoom.
 */
export function sectionLabelReach(size: SectionLabelSize): number {
  return size.fontSize * (size.gapEm + SECTION_LABEL_LINE_EM);
}

/**
 * A book label set as a tab inside its book's box, scaled with the map rather
 * than held to a readable size: its font size, how far above the book's first
 * row its top sits and how far in from its right edge, in map units, and the
 * smallest font, in pixels, it shows at. Smaller, it fades out. With `wrap`, a name too long for
 * its book's width goes on to further lines above the first, instead of running on.
 */
export interface BookTab {
  fontSize: number;
  above: number;
  inset: number;
  minPx: number;
  wrap?: boolean;
}

export interface MapLabelSettings {
  sectionNames: Readonly<Record<string, SectionName>>;
  sectionSize: SectionLabelSize;
  /** Without it, a book's label sits above its book at a size held between bounds. */
  tab?: BookTab;
  /** Which way the text reads: a book's label starts at its right edge, or its left. Right to left unless said. */
  direction?: 'rtl' | 'ltr';
  /**
   * Where a section's name stands: right of its books, reading down, or above them, reading
   * across. Right unless said.
   */
  sectionSide?: 'right' | 'top';
}

/** Only the Hebrew is scaled: the English beside it is a sans face and needs no correction. */
export function hebrewSpan(text: string, className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.style.fontFamily = HEBREW_LABEL_FONT;
  span.style.fontSize = `${HEBREW_LABEL_SCALE}em`;
  span.textContent = text;
  return span;
}

/** Each section's box around its books, in the order the sections first appear. */
function sectionBoxes(books: readonly BookBox[]): Map<string, Box> {
  const boxes = new Map<string, Box>();
  for (const book of books) {
    const b = boxes.get(book.section);
    if (!b) {
      boxes.set(book.section, { minX: book.minX, maxX: book.maxX, minY: book.minY });
      continue;
    }
    b.minX = Math.min(b.minX, book.minX);
    b.maxX = Math.max(b.maxX, book.maxX);
    b.minY = Math.min(b.minY, book.minY);
  }
  return boxes;
}

function bookLabel(book: BookBox): HTMLDivElement {
  const label = document.createElement('div');
  label.className = 'book-label';
  label.style.cssText = `
    position:absolute;
    color:#eee;
    font-weight:700;
    text-shadow:0 1px 3px rgba(0,0,0,0.8);
    white-space:nowrap;
    /* A length, not a factor: the larger Hebrew below inherits it as-is and
       so cannot grow the box the positioning maths below assumes. */
    line-height:${BOOK_LABEL_LINE_EM}em;
    transition:opacity 0.2s;
    transform:translateX(-100%);
  `;
  label.dataset.bookName = book.name;
  label.appendChild(hebrewSpan(book.hebrewName, 'book-label-he'));
  // Shown when there's room.
  const enSpan = document.createElement('span');
  enSpan.className = 'book-label-en';
  enSpan.textContent = ` ${book.name}`;
  enSpan.style.fontFamily = 'var(--heading-font)';
  label.appendChild(enSpan);
  return label;
}

function sectionLabel(
  section: string,
  name: SectionName | undefined,
  side: 'right' | 'top',
): HTMLDivElement {
  const label = document.createElement('div');
  label.style.cssText = `
    position:absolute;
    color:#aaa;
    font-weight:700;
    text-shadow:0 1px 3px rgba(0,0,0,0.8);
    white-space:nowrap;
    line-height:${SECTION_LABEL_LINE_EM}em;
    transform-origin:0 0;
    transform:${side === 'right' ? 'rotate(90deg) translateY(-100%)' : 'none'};
  `;
  // On the right it turns clockwise about its own top-left corner, so the text reads downward
  // from the top of the book labels and its line box sits right of the anchor.
  label.dataset.section = section;
  label.appendChild(hebrewSpan(name?.he ?? section, 'section-label-he'));
  const enSpan = document.createElement('span');
  enSpan.className = 'section-label-en';
  enSpan.style.fontFamily = 'var(--heading-font)';
  enSpan.textContent = ` ${name?.en ?? ''}`;
  label.appendChild(enSpan);
  return label;
}

/**
 * A book label's font size at `zoom`, and how far above its book's first row
 * the label's top sits: its own height, then a gap that scales with the font.
 */
export function bookLabelSize(zoom: number): { fontSize: number; rise: number } {
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * zoom));
  return { fontSize, rise: fontSize + BASE_LABEL_GAP * (fontSize / BASE_FONT_SIZE) };
}

/**
 * Names every book, and every section beside its books, in a container of
 * their own inside `parent`. Returns what moves them with the map.
 */
export function createMapLabels(
  books: readonly BookBox[],
  parent: HTMLElement,
  { sectionNames, sectionSize, tab, direction = 'rtl', sectionSide = 'right' }: MapLabelSettings,
): (pan: Pan, zoom: number) => void {
  const container = document.createElement('div');
  container.id = 'book-labels';
  const inset = tab?.inset ?? 0;
  // The edge of its book the label's own matching edge meets.
  const anchorX =
    direction === 'rtl'
      ? (book: BookBox) => book.maxX - inset
      : (book: BookBox) => book.minX + inset;
  const bookLabels = books.map((book) => {
    const el = bookLabel(book);
    if (direction === 'ltr') el.style.transform = 'none';
    if (tab?.wrap) {
      el.style.whiteSpace = 'normal';
      // The last line stays where a one-line name sits; the rest stand above it.
      el.style.transform = `translateY(calc(-100% + ${BOOK_LABEL_LINE_EM}em))`;
    }
    // A tab keeps its length on the map, so whether its English fits does not change.
    if (tab) {
      const englishWidth = tab.fontSize * (ENGLISH_MIN_BOOK_WIDTH_PX / BASE_FONT_SIZE);
      el.classList.toggle('narrow', book.maxX - book.minX < englishWidth);
    }
    container.appendChild(el);
    return { el, book };
  });
  const sectionLabels = [...sectionBoxes(books)].map(([section, box]) => {
    const el = sectionLabel(section, sectionNames[section], sectionSide);
    container.appendChild(el);
    return { el, box };
  });
  parent.appendChild(container);

  return (pan, zoom) => {
    const { fontSize, rise } = tab
      ? { fontSize: tab.fontSize * zoom, rise: tab.above * zoom }
      : bookLabelSize(zoom);
    for (const { el, book } of bookLabels) {
      el.style.left = (anchorX(book) + pan.x) * zoom + 'px';
      el.style.top = (book.minY + pan.y) * zoom - rise + 'px';
      el.style.fontSize = fontSize + 'px';
      if (tab?.wrap) el.style.width = (book.maxX - book.minX - 2 * inset) * zoom + 'px';
      if (tab) el.style.opacity = fontSize < tab.minPx ? '0' : '';
      else {
        const bookScreenWidth = (book.maxX - book.minX) * zoom;
        el.classList.toggle('narrow', bookScreenWidth < ENGLISH_MIN_BOOK_WIDTH_PX);
      }
    }
    const sectionFontSize = Math.min(MAX_SECTION_FONT_SIZE, sectionSize.fontSize * zoom);
    for (const { el, box } of sectionLabels) {
      const clear = sectionFontSize * sectionSize.gapEm;
      if (sectionSide === 'right') {
        el.style.left = (box.maxX + pan.x) * zoom + clear + 'px';
        el.style.top = (box.minY + pan.y) * zoom - rise + 'px';
      } else {
        el.style.left = (box.minX + pan.x) * zoom + 'px';
        el.style.top =
          (box.minY + pan.y) * zoom - clear - sectionFontSize * SECTION_LABEL_LINE_EM + 'px';
      }
      el.style.fontSize = sectionFontSize + 'px';
    }
  };
}
