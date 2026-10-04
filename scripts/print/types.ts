// What draw() takes: plain data, so it can cross into the page as JSON.

/** Map units, as src/layout.ts gives them. */
export interface PrintVerse {
  x: number;
  y: number;
  /** Side of the drawn square, before any growth. */
  side: number;
  /** One colour, or one per band. */
  fills: string[];
}

export interface BookTitle {
  he: string;
  en: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SectionTitle {
  he: string;
  en: string;
  maxX: number;
  minY: number;
}

export interface KeyRow {
  swatch: string;
  he: string;
  en: string;
  /** Beside the English, quieter: the search key's verse counts. */
  note?: string;
}

export interface KeyGroup {
  heading?: string;
  rows: KeyRow[];
}

export interface KeyColumn {
  heading?: { he: string; en: string };
  width: number;
  groups: KeyGroup[];
}

export interface Key {
  he: string;
  en: string;
  notes: string[];
  columns: KeyColumn[];
  /** Multiplies the rows' type, swatches and spacing; 1 when absent. */
  scale?: number;
}

/** Font families, as fonts.ts loads and checks them. */
export interface Fonts {
  hebrew: string;
  latin: string;
}

export interface Palette {
  paper: string;
  ink: string;
  inkSoft: string;
}

export interface SheetInput {
  kind: 'sheet';
  palette: Palette;
  fonts: Fonts;
  verses: PrintVerse[];
  books: BookTitle[];
  sections: SectionTitle[];
  /** The Torah's left edge and first row, which place the logo. */
  torahMinX: number;
  torahTopY: number;
  logoSvg: string;
  key: Key;
  /**
   * The book (by English name) whose bottom-left corner the key sits beneath,
   * with no rule. Without it, the key sits under a rule below the map.
   */
  keyUnder?: string;
  credits: string;
  bandOffset: number;
  growth: number;
  marks: boolean;
}

export interface ProofPatch {
  title: string;
  verses: PrintVerse[];
  /** The map point at the patch's centre. */
  centre: { x: number; y: number };
}

export interface ProofInput {
  kind: 'proof';
  palette: Palette;
  fonts: Fonts;
  /** Points per map unit, as on the finished sheets. */
  scale: number;
  patches: ProofPatch[];
  /** A patch drawn three ways with each verse's opening letters in its square. */
  microtext: ProofPatch & { words: string[] };
  swatches: { fill: string; name: string; value: string }[];
  bandOffset: number;
  growth: number;
}

export interface DrawResult {
  svg: string;
  /** Page size in points, bleed and slug included. */
  width: number;
  height: number;
  /** Points per map unit. */
  scale: number;
  /** Key entries wider than their column. */
  overflows: string[];
}
