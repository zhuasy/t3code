#!/bin/bash
set -euo pipefail
cd "${T3CODE_SOURCE_REPO:-$(dirname "$0")/../..}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export GIT_TERMINAL_PROMPT=0
status_dir="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}"
mkdir -p "$status_dir"
if ! mkdir "$status_dir/source-update-check.lock" 2>/dev/null; then
  echo "Another update check is already running." >&2
  exit 1
fi
trap 'rmdir "$status_dir/source-update-check.lock"' EXIT
if [[ "$(git branch --show-current)" != "local/custom" ]]; then
  echo "Switch to local/custom before checking updates." >&2
  exit 1
fi
# A check only refreshes remote refs; running source and build files stay untouched.
git fetch --quiet origin main --tags
release="$(git tag --list 'v[0-9]*' --sort=-v:refname | awk '!/-/ && !r { r = $0 } END { print r }')"
if [[ -z "$release" ]]; then
  echo "No upstream release tag found." >&2
  exit 1
fi
if git merge-base --is-ancestor "$release" HEAD; then
  echo "Your local build includes the latest release, $release."
  exit 0
fi
message="Release $release is available ($(git rev-list --count "HEAD..$release") upstream commits)."
echo "$message"
# The scheduled check sets T3CODE_NOTIFY; the menu shows its own dialog.
if [[ -n "${T3CODE_NOTIFY:-}" ]]; then
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "T3 Code (Custom)"' \
    -e 'end run' "$message" || true
fi
