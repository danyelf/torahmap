# Talmud search

**Status:** Implemented 2026-10-15, branch `worktree-talmud-search`. Issue #345. Follow-ups: #382 (search
by Jastrow entry), #389 (show the Davidson text in the popup).

## What it does

The Talmud's search panel works like the Tanakh's: several terms, each in its
own colour; each term matched anywhere in a word or as a whole word; a list of
results with excerpts; matches coloured on the map and in the popup; the search
kept in the link. There is no meanings mode yet; that is #382.

What it is for, in Danyel's examples: every mention of a rabbi, an animal or a
siman, and the phrases of the Talmud's reasoning, such as קל וחומר. Finding
every challenge (קשיא, תיובתא, איתיביה…) is a category rather than a search,
and is left for an overlay of its own.

## The text it reads

Search reads Sefaria's William Davidson edition, not the Wikisource edition
the popup shows. Davidson writes abbreviations out, which plain matching
needs:

| | Wikisource | Davidson |
|---|---|---|
| רבי יוחנן | 2,160 | 4,685 |
| ר׳ יוחנן | 1,430 | 0 |
| קל וחומר | 253 | 589 |
| ק״ו | 338 | 0 |

The two editions line up segment for segment (81,793 segments).
`scripts/talmud/bundle.ts` writes one more file, `public/data/talmud/search.json`:
every segment's Davidson text, its vowels and tags removed, laid out as `texts/`'s amudim. It is
18 MB, about 2.7 MB as served, and downloads after the map first draws, as every tool's files do.

The popup keeps the Wikisource text and its citation links, and its marks are
found by matching the terms again in that text. So a segment found through an
abbreviation is coloured on the map and listed, but that mention is not marked
in the popup. Showing Davidson in the popup instead is #389: Davidson has no
bracketed citations, so it needs the links moved across.

## Matching

- **Anywhere in a word**, as the Tanakh's.
- **Whole word**, which for the Talmud also allows the letters ד ו ל ב כ ש מ ה
  in front: רבי finds דרבי, ורבי and כשרבי. Only a phrase's first word takes
  them. The mark covers the whole written word, prefix included. The Tanakh
  does not turn this on, so its matching is unchanged.
- **Phrases**: a term with spaces matches as a phrase, as it already does.
- **Punctuation ends a word.** The Davidson text has `. : , ? ! —`, so
  whole-word matching treats any character that is not a
  letter or a vowel point as a word's edge. `isWordSeparator` itself stays as
  it is: word clicks and the Tanakh's dictionary line-up depend on it. This
  is the Hebrew language's rule; English already breaks at punctuation.

## One search, in its own package

The search knows no language, so it can serve a text in any: the Tanakh, the
Talmud, or an English-only text such as the EU AI Act (#372). Two new packages
share the work.

**`@torahmap/search`** holds the parts of `apps/tanakh/src/search/` that do not
depend on the Bible dictionary: the term list and its colours and link letters,
the two match modes and phrases, the text index and excerpts, popup marks, the
results list, the term rows, and the telemetry debounce. They become one
function, `createTermSearch(spec)`, which returns the `SearchTool` the shell
already knows. Its state (which row is open, what is shown) lives in that call,
not at module level. It is a package rather than part of the shell because
three things use it: the two apps and the wall prints.

It matches through the languages a text gives it. A language says how text is
folded for comparing, what ends a word, which letters may be attached in front
of a word, and whether a typed term is in it. English, which lowercases and
breaks words at punctuation, is the package's own.

**`@torahmap/hebrew`** holds Hebrew: the folding in `spelling.ts` (vowel points,
final letters), the word breaks and vowel-point helpers now in
`packages/shell/src/hebrew.ts`, and the Hebrew language, whose prefix letters a
text turns on or not. The shell imports it for the popup, which is still
written for a Hebrew and an English text; untangling that is not part of this
change.

A text supplies to `createTermSearch`:

- its languages: Hebrew and English for the Tanakh; Hebrew, with prefixes, for
  the Talmud;
- its search files, and from them an index of each item's id, reference and
  text in each language, built once per set of text files;
- what a result is called ("verse", "segment"), the box's placeholder, its
  description and credits;
- for the Tanakh only, its meanings mode: one object that offers the mode for a
  term, finds its items and marks, draws the meanings chooser, and reads and
  writes its own link key (`m`).

The meanings chooser, word clicks, the
word menu and everything that reads the dictionary stay in `apps/tanakh`.

Choosing a single object for the meanings mode, rather than letting the Tanakh
keep its own term list, is what keeps the two from drifting: one term list, one
set of rows, one results list, one link format.

## What must not change

The Tanakh's search behaves exactly as now, including a Hebrew term starting in
meanings mode. Its existing tests stay and pass; they are repointed to the
packages their code moved to. The layout tests and a before-and-after
screenshot of the Tanakh's search panel check what it looks like.

## Not in this change

- Telemetry for the Talmud's search; `telemetry` gets do-nothing members.
- Serving `/talmud/` on the live site.
- Spelling variants beyond what Davidson writes out.
