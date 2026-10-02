/**
 * How many clicks can the index name a dictionary word for?
 *
 * Clicking a Hebrew word asks which dictionary word it is. The spelling alone
 * is ambiguous for about half the words in the text, so the verse narrows it:
 * a reading the verse does not contain is not the reading in front of you.
 * This walks every word of every verse and reports where they land.
 *
 * Run it after regenerating the lexeme index, which is the thing it measures:
 *
 *     npx tsx scripts/search/click-resolution-report.ts
 *     npm run report:click-resolution
 *
 * It prints the split and, against the baseline recorded beside it, which way
 * each bucket moved. `--save` rewrites that baseline; do it when the move is
 * one you meant, in the same commit as the regenerated index.
 *
 * Why this is a report and not a test: the useful assertion is the one no test
 * can make. A floor loose enough to survive a better index cannot notice a part
 * of speech quietly dropping out of it, which is the failure worth catching and
 * which shows up here as a number that moved.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dictionary } from '../../src/search.ts';
import type { SearchData } from '../../src/search/data.ts';
import type { Parse } from '../../src/search/dictionary.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..', '..');
const publicDir = join(repoRoot, 'public');
const baselinePath = join(scriptDir, 'click-resolution.json');

// The search module fetches its data with a site-absolute URL, so serve public/
// from disk the way the test setup does. This has to be installed before the
// module is imported, hence the dynamic import below.
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const resolved = normalize(join(publicDir, decodeURIComponent(path)));

  if (!resolved.startsWith(publicDir) || !existsSync(resolved)) {
    return new Response(null, { status: 404, statusText: 'Not Found' });
  }
  return new Response(readFileSync(resolved, 'utf8'), { status: 200 });
}) as typeof fetch;

const { loadNamedFiles } = await import('../../src/dataFiles.ts');
const { SEARCH_FILES, dictionaryOf } = await import('../../src/search/data.ts');
const { findLexemesForWord } = await import('../../src/search.ts');
const { meaningsInVerse, spellingFor, wordIsNamed, wordsOfVerse } =
  await import('../../src/search/dictionary.ts');
const { verseWords } = await import('../../src/verseWords.ts');
const { stripNikkud } = await import('../../src/hebrew.ts');
const { tanakhKey } = await import('../../src/types.ts');

interface Report {
  /** Words whose reading the verse settles to exactly one dictionary word. */
  one: number;
  /** Words left with several readings the verse allows. */
  several: number;
  /** Words the spelling is in no index for. */
  unknownSpelling: number;
  /** Words whose every candidate reading the verse rules out. */
  ruledOut: number;
  /** Words a click cannot place in the parse, and so looks up by spelling. */
  unplaced: number;
  /** Words offering a meaning that choosing cannot search for. */
  unsearchable: number;
  total: number;
}

function buildReport(
  texts: Record<string, Record<string, Record<string, { he: string }>>>,
  dictionary: Dictionary,
  parse: Parse,
): Report {
  const report: Report = {
    one: 0,
    several: 0,
    unknownSpelling: 0,
    ruledOut: 0,
    unplaced: 0,
    unsearchable: 0,
    total: 0,
  };

  for (const [book, chapters] of Object.entries(texts)) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const [verse, text] of Object.entries(verses)) {
        const verseKey = tanakhKey(book, Number(chapter), Number(verse));
        const words = wordsOfVerse(parse, verseKey, text.he);

        for (const [wordIndex, { word }] of verseWords(text.he).entries()) {
          const form = stripNikkud(word);
          const offered = meaningsInVerse(dictionary, words, form, verseKey, wordIndex);
          const n = offered.length;
          report.total++;
          if (!wordIsNamed(words, wordIndex)) report.unplaced++;
          // Choosing a meaning searches for it under some spelling; one no
          // spelling can be is a choice that silently searches for something else.
          if (offered.some((m) => spellingFor(dictionary, m.keys, form) === null)) {
            report.unsearchable++;
          }

          if (n === 1) report.one++;
          else if (n > 1) report.several++;
          else if (!findLexemesForWord(dictionary, form)?.length) report.unknownSpelling++;
          else report.ruledOut++;
        }
      }
    }
  }

  return report;
}

function share(n: number, total: number): string {
  return `${((n / total) * 100).toFixed(2)}%`;
}

/** The change in a bucket's share, or blank when there is nothing to compare. */
function movement(now: Report, before: Report | null, key: keyof Report): string {
  if (!before) return '';
  const delta = (now[key] / now.total - before[key] / before.total) * 100;
  if (Math.abs(delta) < 0.005) return '  unchanged';
  return `  ${delta > 0 ? '+' : ''}${delta.toFixed(2)} points`;
}

// Throws, naming the file, when one does not load: a report on a missing
// dictionary would print a confident 100% unknown.
const data = await loadNamedFiles<SearchData>(SEARCH_FILES);
const dictionary = dictionaryOf(data);
const texts = data.texts;

// Every number below is about what a click finds once the per-word parse is
// here; without it the report would measure the fallback under it.
const { parse } = data;
if (!parse) {
  console.error('The per-word parse did not load. The numbers below would be meaningless.');
  process.exit(1);
}

const report = buildReport(texts, dictionary, parse);
const baseline: Report | null = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, 'utf8'))
  : null;

const rows: Array<[string, keyof Report]> = [
  ['names one dictionary word', 'one'],
  ['several readings the verse allows', 'several'],
  ['spelling is in no index', 'unknownSpelling'],
  ['verse rules every reading out', 'ruledOut'],
  ['not placed, so looked up by spelling', 'unplaced'],
  ['offers a meaning it cannot search', 'unsearchable'],
];

console.log(`\n${report.total.toLocaleString()} clickable words\n`);
for (const [label, key] of rows) {
  const count = report[key].toLocaleString().padStart(9);
  console.log(
    `  ${label.padEnd(36)}${count}  ${share(report[key], report.total).padStart(7)}` +
      movement(report, baseline, key),
  );
}

if (!baseline) {
  console.log('\nNo baseline recorded yet. Run with --save to write one.');
} else if (baseline.total !== report.total) {
  console.log(
    `\nThe corpus itself changed: ${baseline.total.toLocaleString()} words then, ` +
      `${report.total.toLocaleString()} now. Shares still compare; counts do not.`,
  );
}

if (process.argv.includes('--save')) {
  writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nBaseline written to ${baselinePath.replace(`${repoRoot}/`, '')}`);
}

console.log();
