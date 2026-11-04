#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$PATH"
if [[ "$(git branch --show-current)" != "local/custom" ]]; then
  echo "Switch to local/custom before updating." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash local changes before updating." >&2
  exit 1
fi
lock_dir="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}/source-update-install.lock"
mkdir -p "$(dirname "$lock_dir")"
if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "Another update is already running." >&2
  exit 1
fi
trap 'rmdir "$lock_dir"' EXIT
git fetch origin main
git rebase origin/main
vp i --frozen-lockfile
vp run check:changed origin/main
vp run build:desktop
if git remote get-url fork >/dev/null 2>&1; then
  git push --force-with-lease fork local/custom ||
    echo "Push to the fork failed. Unlock 1Password, then run: git push --force-with-lease fork local/custom" >&2
fi
echo "Updated and rebuilt. Quit T3 Code (Custom), then open it again."
