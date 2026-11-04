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
git fetch origin main --tags
# Follow stable releases, not main's HEAD. awk reads every tag so the pipe never breaks early.
release="$(git tag --list 'v[0-9]*' --sort=-v:refname | awk '!/-/ && !r { r = $0 } END { print r }')"
if [[ -z "$release" ]]; then
  echo "No upstream release tag found." >&2
  exit 1
fi
if git merge-base --is-ancestor "$release" HEAD; then
  if [[ "$(cat "$built_head" 2>/dev/null)" == "$(git rev-parse HEAD)" ]]; then
    echo "Your local build already includes $release. Nothing to update."
    exit 0
  fi
else
  # A release older than the current base would replay upstream commits as local ones.
  if ! git merge-base --is-ancestor "$(git merge-base HEAD origin/main)" "$release"; then
    echo "$release is older than the upstream base of this build. Wait for the next release." >&2
    exit 1
  fi
  # A failed fetch or an aborted rebase leaves the previous build intact, so mark only after this.
  git rebase "$release"
fi
touch "$incomplete_marker"
vp i --frozen-lockfile
vp run check:changed "$release"
vp run build:desktop
rm "$incomplete_marker"
git rev-parse HEAD >"$built_head"
if git remote get-url fork >/dev/null 2>&1; then
  git push --force-with-lease fork local/custom ||
    echo "Push to the fork failed. Run: git push --force-with-lease fork local/custom" >&2
fi
echo "Updated to $release and rebuilt. Quit T3 Code (Custom), then open it again."
