import { describe, it, expect } from 'vitest';
import { EVERYTHING } from './loading/files';
import { registerAllOverlays } from '@torahmap/tanakh/overlays/index.ts';
import { getAllOverlays } from '@torahmap/tanakh/overlays/registry.ts';
import { searchTool } from '@torahmap/tanakh/search/index.ts';
import { overlayFiles } from '../packages/shell/src/dataFiles.ts';
import { STRUCTURE_FILE } from '@torahmap/tanakh/verseTexts.ts';

describe("the loading suite's list of files", () => {
  it('names every file the tools name but the structure', () => {
    registerAllOverlays();
    const named = overlayFiles([searchTool, ...getAllOverlays()]).filter(
      (path) => path !== STRUCTURE_FILE,
    );
    expect(new Set(EVERYTHING)).toEqual(new Set(named));
  });
});
