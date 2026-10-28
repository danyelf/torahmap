import { describe, expect, it } from 'vitest';
import { titleCase } from '../src/overlays/titleCase.ts';

describe('keywords shown in Title Case', () => {
  it('capitalises each word', () => {
    expect(titleCase('visual analytics')).toBe('Visual Analytics');
    expect(titleCase('cost-benefit analysis')).toBe('Cost-Benefit Analysis');
  });

  it('keeps acronyms and mixed-case words as written', () => {
    expect(titleCase('large language models (LLM)')).toBe('Large Language Models (LLM)');
    expect(titleCase('VR and 3D displays')).toBe('VR and 3D Displays');
    expect(titleCase('t-SNE projections')).toBe('t-SNE Projections');
    expect(titleCase('iPhone sensing')).toBe('iPhone Sensing');
  });

  it('keeps short joining words lower case, unless they come first', () => {
    expect(titleCase('visualization of uncertainty')).toBe('Visualization of Uncertainty');
    expect(titleCase('the design of visual analytics for the web')).toBe(
      'The Design of Visual Analytics for the Web',
    );
  });
});
