import { describe, expect, it } from 'vitest';
import { englishMarkers } from '../english.ts';

describe('englishMarkers', () => {
  it('marks bold and italic, and keeps the text between', () => {
    expect(englishMarkers('<b>The Rabbis say:</b> the <i>Shema</i>')).toBe(
      '*The Rabbis say:* the _Shema_',
    );
  });

  it('marks a label, and the spans that mark translation, as bold', () => {
    expect(
      englishMarkers('<strong>MISHNA:</strong> <span class="gemarra-regular">One who</span> sees'),
    ).toBe('*MISHNA:* *One who* sees');
  });

  it('marks italic inside bold, and bold inside italic', () => {
    expect(englishMarkers('<b>the <i>halakha</i> is</b>')).toBe('*the _halakha_ is*');
    expect(englishMarkers('<i>hokhe’aḥ <b>tokhiaḥ</b></i>')).toBe('_hokhe’aḥ *tokhiaḥ*_');
  });

  it('marks bold inside bold once', () => {
    expect(englishMarkers('<b>a <b>b</b> c</b>')).toBe('*a b c*');
  });

  it('joins a stretch closed and opened again at once', () => {
    expect(englishMarkers('<b>a</b><b>b</b>')).toBe('*ab*');
  });

  it('breaks the line at a <br>', () => {
    expect(englishMarkers('a<br><br/>b')).toBe('a\n\nb');
  });

  it('fixes the one label left open', () => {
    expect(
      englishMarkers('x. <br><br><strong>MISHNA:<strong> <b>One who</b> sees </strong></strong>'),
    ).toBe('x. \n\n*MISHNA:* *One who* sees');
  });

  it('refuses a tag it does not know', () => {
    expect(() => englishMarkers('<a href="x">link</a>')).toThrow();
    expect(() => englishMarkers('<span class="other">x</span>')).toThrow();
  });

  it('refuses a tag left open, or closed out of turn', () => {
    expect(() => englishMarkers('<b>open')).toThrow();
    expect(() => englishMarkers('closed</b>')).toThrow();
    expect(() => englishMarkers('<b><i>x</b></i>')).toThrow();
  });

  it('refuses text that holds a marker', () => {
    expect(() => englishMarkers('2 * 3')).toThrow();
    expect(() => englishMarkers('snake_case')).toThrow();
  });
});
