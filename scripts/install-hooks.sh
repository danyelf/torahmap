#!/usr/bin/env sh
#
# Point git at the tracked hooks in .githooks/.
#
# Run once per clone:   ./scripts/install-hooks.sh
# It also runs automatically as npm's "prepare" script, so `npm install`
# installs the hooks for you.
#
# core.hooksPath is repository-wide config, shared by every worktree. We set it
# to the RELATIVE path ".githooks", which git resolves against the top of
# whichever worktree is committing -- so one setting covers the main checkout
# and every present and future worktree, each running the hook checked out on
# its own branch.

set -u

# Never break `npm install` over this.
if ! command -v git >/dev/null 2>&1; then
  echo "install-hooks: git not found; skipping hook installation." >&2
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "install-hooks: not inside a git repository; skipping hook installation." >&2
  exit 0
fi

current=$(git config --get core.hooksPath 2>/dev/null || true)

if [ "$current" = ".githooks" ]; then
  exit 0
fi

if [ -n "$current" ]; then
  echo "install-hooks: replacing core.hooksPath '$current' with '.githooks'." >&2
fi

if ! git config core.hooksPath .githooks; then
  echo "install-hooks: could not set core.hooksPath; hooks are NOT installed." >&2
  echo "install-hooks: run 'git config core.hooksPath .githooks' by hand." >&2
  exit 0
fi

# Git records the executable bit, but a stray umask or a filesystem that drops
# modes would leave the hook unrunnable and git would silently skip it.
chmod +x .githooks/* 2>/dev/null || true

echo "install-hooks: git hooks installed (core.hooksPath = .githooks)."
