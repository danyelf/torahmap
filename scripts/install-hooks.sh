#!/usr/bin/env sh
#
# Point git at the tracked hooks in .githooks/.
#
# Run once per clone:   ./scripts/install-hooks.sh
# Re-running is harmless, and repairs a hook whose executable bit was lost.
#
#   --force      replace a core.hooksPath that is already set to something else
#   --warn-only  for unattended callers: warn instead of failing when another
#                hooks path is already configured
#
# core.hooksPath is repository-wide config, shared by every worktree. We set it
# to the RELATIVE path ".githooks", which git resolves against the top of
# whichever worktree is committing -- so one setting covers the main checkout
# and every present and future worktree, each running the hook checked out on
# its own branch.

set -u

WANT=".githooks"
force=0
warn_only=0

for arg in "$@"; do
  case "$arg" in
    -f | --force) force=1 ;;
    --warn-only) warn_only=1 ;;
    -h | --help)
      sed -n '2,17p' "$0" | sed 's/^#\{1,2\} \{0,1\}//'
      exit 0
      ;;
    *)
      echo "install-hooks: unknown argument '$arg' (try --help)" >&2
      exit 2
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  echo "install-hooks: git not found; skipping hook installation." >&2
  exit 0
fi

# Everything below works on absolute paths built from the repository root, so
# that running this from a subdirectory (scripts/, say) behaves identically.
root=$(git rev-parse --show-toplevel 2>/dev/null) || root=""
if [ -z "$root" ]; then
  echo "install-hooks: not inside a git working tree; skipping hook installation." >&2
  exit 0
fi

current=$(git config --get core.hooksPath 2>/dev/null || true)

# Refuse to silently disable someone else's hooks. core.hooksPath may have been
# set globally or by an organisation, and clobbering it would turn off hooks
# this project knows nothing about.
if [ -n "$current" ] && [ "$current" != "$WANT" ] && [ "$force" -eq 0 ]; then
  echo "" >&2
  echo "  install-hooks: NOT installing hooks." >&2
  echo "" >&2
  echo "  core.hooksPath is already set to:" >&2
  echo "      $current" >&2
  echo "" >&2
  echo "  That may be a global or organisation-wide setting rather than this" >&2
  echo "  project's, so this script will not overwrite it on its own." >&2
  echo "" >&2
  echo "  If it is stale and you want this project's hooks, re-run with:" >&2
  echo "      $0 --force" >&2
  echo "" >&2
  [ "$warn_only" -eq 1 ] && exit 0
  exit 1
fi

if [ "$current" != "$WANT" ]; then
  if ! git config core.hooksPath "$WANT"; then
    echo "install-hooks: could not set core.hooksPath; hooks are NOT installed." >&2
    echo "install-hooks: run 'git config core.hooksPath $WANT' by hand." >&2
    exit 1
  fi
fi

# A branch predating .githooks/ has no hooks to install. core.hooksPath is
# repository-wide, so leaving it set is still correct for other worktrees.
if [ ! -d "$root/$WANT" ]; then
  echo "install-hooks: core.hooksPath set, but $WANT/ does not exist on this" >&2
  echo "install-hooks: branch, so no hook will run here until you rebase." >&2
  exit 0
fi

# Git records the executable bit, but a stray umask, a filesystem that drops
# modes, or a stale checkout can leave a hook unrunnable -- and git skips a
# non-executable hook silently, which looks exactly like having no gate at all.
# So chmod, then assert the result rather than trusting the exit status.
if ! chmod +x "$root/$WANT"/*; then
  echo "install-hooks: could not make $WANT/* executable; hooks would be" >&2
  echo "install-hooks: skipped silently by git. Fix the permissions and re-run." >&2
  exit 1
fi

if [ ! -x "$root/$WANT/pre-commit" ]; then
  echo "install-hooks: $WANT/pre-commit is not executable; git would skip it" >&2
  echo "install-hooks: silently. Hooks are NOT reliably installed." >&2
  exit 1
fi

echo "install-hooks: git hooks installed (core.hooksPath = $WANT)."
