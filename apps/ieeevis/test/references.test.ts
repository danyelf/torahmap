import { describe, expect, it } from 'vitest';
import { referenceLines } from '../src/references.ts';

describe('a reference list', () => {
  it('puts each numbered entry on its own line', () => {
    expect(
      referenceLines('[1] A. Author. A title. 2020. 1, 2 [2] B. Author. Another. 2021. 3'),
    ).toBe('[1] A. Author. A title. 2020. 1, 2\n[2] B. Author. Another. 2021. 3');
  });

  it('leaves a bracket that is not the start of an entry', () => {
    expect(referenceLines('[1] A. Author. See [7]. 2020.')).toBe('[1] A. Author. See [7]. 2020.');
  });
});
