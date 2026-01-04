// Shared types for Torah Map

export interface Book {
  name: string;
  hebrewName: string;
  chapters: number[];
}

export interface TorahData {
  books: Book[];
}

export interface Verse {
  book: string;
  chapter: number;
  verse: number;
  x: number;
  y: number;
  size: number;
  color?: [number, number, number];
}

export interface Bounds {
  width: number;
  height: number;
}

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
