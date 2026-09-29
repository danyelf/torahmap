---
name: drift-review
description: Use when Danyel asks for a naive review, a second pair of eyes, or a check for duplication, redundancy, drift, or doing the same thing two ways — on a pull request, a branch or the current change.
---

# Drift review

Danyel's standing review is not a correctness review. He assumes the change
works; what he fears is a codebase that says the same thing in two places and
lets them drift apart.

"Naive" means a fresh subagent that has not seen this conversation, the pull
request description or `docs/plans/`. They are the author's account, and the
reviewer should form its own.

## Dispatch

The target is what he names: a pull request number, a branch, or else the
current branch against `origin/main`. Send one `general-purpose` subagent in the
background with this brief, filled in:

> Review <target> in the torahmap repo at <path>. Read the diff (`gh pr diff N`
> or `git diff origin/main...HEAD`), skipping `package-lock.json` and anything
> under `docs/plans/`. Read whole files at the change's head
> (`git fetch origin pull/N/head`, then `git show FETCH_HEAD:<path>`). Do not
> read the pull request description. Change nothing, commit nothing, post
> nothing.
>
> Assume the code works. Look for, in this order:
>
> 1. The same thing done in two places, or two ways — logic, lists, strings,
>    types. Anything that can drift out of step with a twin.
> 2. A value written out where one named constant or one source of truth should
>    be read. Code that tells dev, preview and live apart by matching a hostname
>    is always a finding: that comes from the Vite config.
> 3. Anything computed twice.
> 4. Cleverness, indirection or machinery the change does not need; dead code.
> 5. Boundaries: an overlay's content lives only under `src/overlays/`, and each
>    package keeps to what CLAUDE.md's Project Structure says it is for.
> 6. Prose, judged by AGENTS.md. Cut by default and argue for what stays.
>
> Report a correctness bug only if you trip over one. Verify every finding
> before reporting it and cite `path:line`. Reply with a numbered list, most
> important first, one or two sentences each, ending with the fix you would
> make.

## Bringing it back

Open each cited line before relaying it: reviewers misread, and the code may
have moved. Drop what does not hold up, and correct what only partly does. Show
Danyel the numbered list in chat, one line per finding with its proposed fix,
so he can answer by number ("1 yes, 2 don't care"). Change nothing until he
answers. Fixes to a merged pull request go on a new branch from main.
