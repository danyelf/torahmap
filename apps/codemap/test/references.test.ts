import { describe, expect, it } from 'vitest';
import { lineReader } from '../src/references.ts';

const { read, complete } = lineReader(['a.ts:1', 'a.ts:2', 'a.ts:3', 'lib/b.ts:1', 'lib/b.ts:2']);

describe('lineReader', () => {
  it('reads a path and line as that line', () => {
    expect(read('a.ts:3')).toEqual({ ref: 'a.ts:3', ids: ['a.ts:3'] });
  });

  it('reads a path alone as all its lines', () => {
    expect(read('a.ts')).toEqual({ ref: 'a.ts', ids: ['a.ts:1', 'a.ts:2', 'a.ts:3'] });
    expect(read(' lib/b.ts ')?.ids).toEqual(['lib/b.ts:1', 'lib/b.ts:2']);
  });

  it('reads nothing for a file or line the map does not have', () => {
    for (const typed of ['', 'c.ts', 'a.ts:4', 'a.ts:0', 'a.ts:x', 'b.ts']) {
      expect(read(typed), typed).toBeNull();
    }
  });

  it('completes a path from its start or from any folder in it', () => {
    expect(complete('a')).toEqual(['a.ts']);
    expect(complete('b')).toEqual(['lib/b.ts']);
    expect(complete('lib/')).toEqual(['lib/b.ts']);
    expect(complete('a.ts')).toEqual([]);
    expect(complete('')).toEqual([]);
  });
});
