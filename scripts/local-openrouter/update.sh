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
state_dir="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}"
lock_dir="$state_dir/source-update-install.lock"
incomplete_marker="$state_dir/source-update-incomplete"
built_head="$state_dir/source-built-head"
mkdir -p "$state_dir"
if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "Another update is already running." >&2
  exit 1
fi
trap 'rmdir "$lock_dir"' EXIT
# The menu starts this script as the app quits; its server can take a while to stop.
for ((wait = ${T3CODE_UPDATE_WAIT:-120}; ; wait--)); do
  pgrep -f "$PWD/apps/desktop/.electron-runtime/" >/dev/null || break
  if ((wait <= 1)); then
    echo "T3 Code (Custom) is still running. Quit it, then run the update again." >&2
    exit 1
  fi
  sleep 1
done
git fetch fork local/custom
# Follow your fork's local/custom; local commits not on the fork yet stay on top.
if ! git merge --ff-only fork/local/custom; then
  echo "local/custom and fork/local/custom have diverged. Rebase or reset, then update again." >&2
  exit 1
fi
if [[ "$(cat "$built_head" 2>/dev/null)" == "$(git rev-parse HEAD)" ]]; then
  echo "Your local build already matches your fork. Nothing to update."
  exit 0
fi
touch "$incomplete_marker"
vp i --frozen-lockfile
vp run build:desktop
rm "$incomplete_marker"
git rev-parse HEAD >"$built_head"
if ! git merge-base --is-ancestor HEAD fork/local/custom; then
  git push fork local/custom ||
    echo "Push to the fork failed. Run: git push fork local/custom" >&2
fi
echo "Updated to $(git rev-parse --short HEAD) from your fork and rebuilt."
