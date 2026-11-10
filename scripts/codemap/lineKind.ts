import type { LineKind } from '../../apps/codemap/src/data.ts';

const SCRIPT_FILE = /\.(ts|js|mjs)$/;
const PYTHON_FILE = /\.py$/;

const SCRIPT_IMPORT = /^\s*(import\b|export\s+(\*|(type\s+)?\{[^}]*\})\s*(as\s+\w+\s+)?from\b)/;
const PYTHON_IMPORT = /^\s*(import|from)\s+\S/;

const SCRIPT_HEADERS = [
  /^\s*(export\s+)?(default\s+)?(async\s+)?(abstract\s+)?(function\b|class\b|interface\b)/,
  /^\s*(export\s+)?(const|let)\s+[\w$]+\s*(:[^=]+)?=\s*(async\s+)?(\([^'"`]*\)|[\w$]+)\s*(:[^=]+)?=>\s*\{\s*$/,
  // Statements that open a block are keywords, not methods.
  /^\s*(?!(if|for|while|switch|catch|with|return|else|function)\b)((public|private|protected|static|async|readonly|get|set|override)\s+)*[\w$]+\s*(<[^>]*>)?\([^'"`]*\)\s*(:[^{]+)?\{\s*$/,
];
const PYTHON_HEADER = /^\s*(async\s+)?(def|class)\s/;

function isScript(path: string): boolean {
  return SCRIPT_FILE.test(path);
}

/** One LineKind character per line. A block comment spans lines, so it takes the whole file. */
export function lineKinds(path: string, lines: readonly string[]): string {
  const script = isScript(path);
  const python = PYTHON_FILE.test(path);
  let inBlockComment = false;
  return lines
    .map((line): LineKind => {
      if (line.trim() === '') return 'b';
      if (!script && !python) return 'x';
      if (inBlockComment) {
        if (line.includes('*/')) inBlockComment = false;
        return 'c';
      }
      const text = line.trim();
      if (script) {
        if (text.startsWith('//')) return 'c';
        if (text.startsWith('/*')) {
          inBlockComment = !text.includes('*/', 2);
          return 'c';
        }
        if (SCRIPT_IMPORT.test(line)) return 'i';
        return SCRIPT_HEADERS.some((header) => header.test(line)) ? 'h' : 'x';
      }
      if (text.startsWith('#')) return 'c';
      if (PYTHON_IMPORT.test(line)) return 'i';
      return PYTHON_HEADER.test(line) ? 'h' : 'x';
    })
    .join('');
}
