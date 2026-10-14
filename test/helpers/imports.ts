/**
 * `from './x'`, `import './x'` and `import('./x')`, or the same of a path from the project root
 * (`/src/x.ts`, as Vite reads it) or of one of our packages.
 */
export const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*['"`]([./][^'"`]+|@torahmap\/[^'"`]+)['"`]/g;
