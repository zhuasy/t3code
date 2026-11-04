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
git fetch --quiet origin main
upstream_sha="$(git rev-parse origin/main)"
current_sha="$(git rev-parse HEAD)"
update_count="$(git rev-list --count HEAD..origin/main)"
python3 - "$status_dir" "$upstream_sha" "$current_sha" "$update_count" <<'PY'
import datetime, json, pathlib, sys
folder, upstream, current, count = sys.argv[1:]
count = int(count)
status = dict(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
              upstream=upstream, current=current, commitsBehind=count)
path = pathlib.Path(folder) / 'source-update-status.json'
temp = path.with_suffix('.tmp')
temp.write_text(json.dumps(status, indent=2) + '\n')
temp.replace(path)
print(f'{count} upstream commits are available.' if count else 'Your local build includes the latest upstream main.')
PY
