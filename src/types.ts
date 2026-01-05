// Shared types for Torah Map

export interface Book {
  name: string;
  hebrewName: string;
  chapters: number[];
}

export interface TorahData {
  books: Book[];
}

/**
 * Divine names data structure.
 * Maps book names to arrays of chapters, where each chapter is an array of verse codes.
 * Verse codes: 0 = no divine name, 1 = YHWH, 2 = Elohim, 3 = both
 */
export type DivineNamesData = { [bookName: string]: number[][] };

export interface Verse {
  book: string;
  chapter: number;
  verse: number;
  x: number;
  y: number;
  size: number;
  color?: [number, number, number];
  highlighted?: boolean;
}

export interface Bounds {
  width: number;
  height: number;
}

// Commentary counts from Sefaria
export interface VerseCommentary {
  total: number;
  categories: Record<string, number>;
}

export type CommentaryData = Record<string, Record<string, Record<string, VerseCommentary>>>;
// Structure: { [book]: { [chapter]: { [verse]: VerseCommentary } } }

export interface ShaderProgram {
  program: WebGLProgram;
  attribs: {
    position: number;
    color: number;
    uv: number;
  };
  uniforms: {
    resolution: WebGLUniformLocation | null;
    pan: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
  };
}
