#!/usr/bin/env bash
set -euo pipefail

# Timestamp for commit messages (UTC ISO8601)
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
viewer_dir="$(cd "$script_dir/.." && pwd)"
data_dir="$(cd "$script_dir/../data" && pwd)"
site_repo_dir="/Users/danyel/code/MISC/danyelf.github.io"
target_dir="$site_repo_dir/torahmap"

cd "$viewer_dir"

echo "Building viewer..."
npm run build

dist_dir="$viewer_dir/dist"
if [ ! -d "$dist_dir" ]; then
  echo "Build failed: dist not found" >&2
  exit 1
fi

echo "Syncing dist to $target_dir"
mkdir -p "$target_dir"
# Use rsync to preserve permissions and remove deleted files
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$dist_dir/" "$target_dir/"
  # copy texts data files
  if [ -d "$data_dir/texts" ]; then
    echo "Copying texts to $target_dir/data/texts/"
    mkdir -p "$target_dir/data/texts/"
    rsync -a "$data_dir/texts/" "$target_dir/data/texts/"
  fi
else
  # fallback to cp
  rm -rf "$target_dir"/* || true
  cp -R "$dist_dir/"* "$target_dir/"
  # copy texts data files
  if [ -d "$data_dir/texts" ]; then
    echo "Copying texts to $target_dir/data/texts/"
    mkdir -p "$target_dir/data/texts/"
    cp -R "$data_dir/texts/"* "$target_dir/data/texts/"
  fi
fi

if [ -d "$site_repo_dir/.git" ]; then
  echo "Committing to personal site repo at $site_repo_dir"
  cd "$site_repo_dir"
  git add torahmap
  # Only commit if there are staged changes
  if git diff --staged --quiet; then
    echo "No changes to commit"
  else
    git commit -m "Deploy torahmap - $TIMESTAMP"
    git push
  fi
else
  echo "Personal site repo not found at $site_repo_dir; skipping git commit/push"
fi
