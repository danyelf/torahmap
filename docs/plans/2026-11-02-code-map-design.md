# The code map

**Status:** Built, awaiting Danyel's review (PR #564). Preview only.

A map of a codebase in the manner of SeeSoft (Eick, Steffen and Sumner, 1992): every line of code
drawn as a thin bar in a fixed place, coloured by what a pull request did to it and by how much it
has changed over time. It is a new text on the shared engine and shell (`createApp`), like the EU AI
Act and IEEE VIS maps.

## Why

When Claude reports that a pull request changes 1,200 lines in 53 files, the count says nothing
about *which* 53. The map answers that at a glance: whether the change sits in one place or is
spread across the repo, whether it is mostly tests, logic or boilerplate, and whether it lands in
code that is already churning.

The engine fits because SeeSoft's idea is torahmap's: a fixed position per line, with analyses as
colour on the same ground. The Talmud map already draws 81,793 squares; the map of this repo is about
139,000 lines, more than that, and it needs no new engine work.

## Goals

- **The pull request's change, in two modes.**
  - *All commits:* the branch against main, each line marked added, changed or deleted.
  - *Step by step:* one commit at a time, in order, with the same three marks for that commit alone.
    Commits do not get a colour each.
- **Churn:** how recently each line last changed, and how many times it has changed.
- **Line type:** import, comment, function header, blank, and other kinds a builder finds useful.
- **Line shape:** each bar starts at the line's indent and is as long as the line, so a file is a
  tiny picture of its code and can be recognised by its shape.
- **The whole repo is drawn.** Lines the analysis picks out are lit; the rest fade back, so the
  changed files stand out against the codebase.

## Non-goals, for now

- Any repo but torahmap. The path is from specific to general (below), but the first version maps
  only this one.
- Coverage and last author. Both are welcome later as overlays; neither is needed for the PR question.
- Showing how lines move across history, as Augur did. Lines move when code changes, which breaks the
  fixed position the map rests on; history is carried as colour on today's lines instead.
- A diff engine of our own. `git diff`, `git blame` and `git log` supply everything.

## Anti-goals

- A second animation path. Stepping between commits goes through the renderer's picture cross-fade
  like every other change to the map.
- A colour per commit.

## Decided

- **The map is drawn from the head of the branch.** Every line that exists there is a bar.
- **A deletion is a mark where the code was removed**, so a pull request that mostly deletes is not
  an empty map.
- **"Changed" is inferred.** Git records lines removed and added, not lines rewritten. A run of
  removed lines followed by added lines in the same hunk counts as changed; added lines with nothing
  removed are added. This is a reading of the diff, usually right, and the design says so rather than
  presenting it as git's word.
- **Churn covers each file's whole history** and is computed once, when the data is built. When a
  line last changed comes from `git blame`; how many times it changed, from walking the file's
  `git log`. This pull request's marks are separate: they come from its own commits only.
- **The map is a live link**, not a picture in the PR description, because step-by-step mode needs
  clicking. A still picture can come later.
- **The data comes from a script in `scripts/codemap/`**, run locally against a repo and two refs.
  It reads only git, so unlike the VIS scraper it needs no project of its own, and it imports the
  map's data shapes, so the two cannot disagree. To see a pull request, its output is committed to
  `public/data/codemap/` in that PR's branch, and the branch's Cloudflare preview shows the map.
  Nothing depends on a `localhost` link, since Danyel often looks remotely. When a GitHub Action
  comes, the script may move to a project of its own.
- **Two open PRs that both carry the data conflict** when the second merges. The files are
  generated, so the conflict is settled by running the script again.
- **Next step: a GitHub Action** that makes the data on every pull request. It is also the form
  other people would install.

## The path to general

1. torahmap's own pull requests.
2. Any repo on this machine, given its path and a branch.
3. Anyone: point a git URL at it, run a script we provide, or register a GitHub Action we publish.

The first step should not close off the third: the data script takes a repo and two refs and knows
nothing about torahmap, and the map reads only its data files.

## Claude's calls, for Danyel to check

- **Bars need no renderer change.** `MapItem` already takes a `width` apart from its `size`, and the
  renderer already widens squares into bars (taking out their jitter). The indent is the bar's `x`.
  The moiré rules apply as they stand, and the map is checked at zoom 0.25 and 0.22 like the others.
- **Every mark sits on the head.** A line a commit touched that a later commit removed or rewrote is
  marked where it would be in the head, the same way as a deletion. A deleted file stays on the map as
  a short stub in its old place, carrying a deletion mark.
- **What is drawn:** every file git tracks that is text and written by hand. Lockfiles, `public/data/`,
  generated files and binaries are left out, by a short list kept beside the data script.
- **Renames are followed** (`git diff -M`, `git log --follow`), so a moved file is not counted as all
  new.
- **Preview only**, like the VIS map: not on the live site. The repo is public, so the code text in
  the data is no exposure.
- **It joins the repo's checks** like any text: an entry in `pages.ts` and `build.ts`, and its
  states in the layout suite. Its overlays are defined in its own folder, as the AI Act's are; the
  overlay catalog is the Tanakh's.

## Left to the builder

- The layout: how folders group into sections and files into columns, as books and chapters do on
  the other maps; the scale of bar length to line length; very long files.
- Which line types to recognise beyond the four named, and how (the TypeScript compiler, or a
  simpler line-by-line reading).
- Colours, labels, the popup (the line's text, its file and number, its last commit).
- How the two modes and the overlays appear in the menu.
