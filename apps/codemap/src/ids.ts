// A line's id is its file's path and its 1-based line number.

export const lineId = (path: string, line: number): string => `${path}:${line}`;

export function parseLineId(id: string): { path: string; line: number } {
  const colon = id.lastIndexOf(':');
  return { path: id.slice(0, colon), line: Number(id.slice(colon + 1)) };
}
