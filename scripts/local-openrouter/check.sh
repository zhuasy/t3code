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
git fetch --quiet fork local/custom
behind="$(git rev-list --count HEAD..fork/local/custom)"
if [[ "$behind" == 0 ]]; then
  echo "Your local build is up to date with your fork."
  exit 0
fi
message="Your fork has $behind new commits on local/custom."
echo "$message"
# The scheduled check sets T3CODE_NOTIFY; the menu shows its own dialog.
if [[ -n "${T3CODE_NOTIFY:-}" ]]; then
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "T3 Code (Custom)"' \
    -e 'end run' "$message" || true
fi
