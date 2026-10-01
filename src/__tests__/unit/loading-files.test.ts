import { describe, it, expect } from 'vitest';
import { EVERYTHING } from '../../../loading/files';
import { registerAllOverlays } from '../../overlays/index';
import { getAllOverlays } from '../../overlays/registry';
import { searchTool } from '../../overlays/search/index';
import { overlayFiles } from '../../dataFiles';
import { STRUCTURE_FILE } from '../../verseTexts';

describe("the loading suite's list of files", () => {
  it('names every file the tools name but the structure', () => {
    registerAllOverlays();
    const named = overlayFiles([searchTool, ...getAllOverlays()]).filter(
      (path) => path !== STRUCTURE_FILE,
    );
    expect(new Set(EVERYTHING)).toEqual(new Set(named));
  });
});
