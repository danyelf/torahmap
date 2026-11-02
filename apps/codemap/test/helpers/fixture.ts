// A small hand-written pull request: three files (one deleted) and two commits.

import type { CodeFile, CodeStructure, CodeTexts } from '../../src/data.ts';

const noMarks = { marks: '', deletedBefore: [] };

const main: CodeFile = {
  path: 'src/main.ts',
  indent: [0, 0, 2, 2, 0, 0],
  length: [24, 0, 14, 9, 0, 7],
  kind: 'ibxxbc',
  lastChanged: [
    1_700_000_000, 1_700_000_000, 1_760_000_000, 1_760_000_000, 1_700_000_000, 1_730_000_000,
  ],
  timesChanged: [1, 1, 5, 5, 1, 2],
  pr: { marks: '..ac..', deletedBefore: [2, 4] },
  commits: [
    { marks: '..a...', deletedBefore: [2] },
    { marks: '...c..', deletedBefore: [4] },
  ],
};

const util: CodeFile = {
  path: 'src/util.ts',
  indent: [0, 2, 0],
  length: [10, 14, 0],
  kind: 'cxb',
  lastChanged: [1_750_000_000, 1_750_000_000, 1_750_000_000],
  timesChanged: [3, 3, 3],
  pr: { marks: '.a.', deletedBefore: [3] },
  commits: [
    { marks: '...', deletedBefore: [] },
    { marks: '.a.', deletedBefore: [3] },
  ],
};

const old: CodeFile = {
  path: 'src/old.ts',
  indent: [],
  length: [],
  kind: '',
  lastChanged: [],
  timesChanged: [],
  pr: noMarks,
  commits: [noMarks, noMarks],
  deleted: true,
};

export const fixtureStructure: CodeStructure = {
  repoUrl: 'https://github.com/example/repo',
  base: 'a'.repeat(40),
  head: 'b'.repeat(40),
  commits: [
    { sha: '1'.repeat(40), subject: 'Add a line' },
    { sha: '2'.repeat(40), subject: 'Change a line' },
  ],
  files: [main, old, util],
};

export const fixtureTexts: CodeTexts = [
  ["import { x } from './x';", '', '  const a = 1;', '  run(a);', '', '// done'],
  [],
  ['// helpers', '  const b = 2;', ''],
];
