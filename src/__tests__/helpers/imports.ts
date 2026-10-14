/** `from './x'`, `import './x'` and `import('./x')`, or the same of one of our packages. */
export const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*['"](\.[^'"]+|@torahmap\/[^'"]+)['"]/g;
