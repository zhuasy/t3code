#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
update_state="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}"
if [[ -e "$update_state/source-update-incomplete" || -d "$update_state/source-update-install.lock" ||
      -d "$(git rev-parse --git-path rebase-merge)" || -d "$(git rev-parse --git-path rebase-apply)" ]]; then
  echo "The source update is incomplete or still running. Resolve any rebase conflict, then rerun scripts/local-openrouter/update.sh before launching." >&2
  exit 1
fi
export PATH="$HOME/.local/share/vite-plus/bin:$PATH"
export T3CODE_HOME="${T3CODE_LOCAL_HOME:-$HOME/.t3}"
unset VITE_DEV_SERVER_URL ELECTRON_RUN_AS_NODE
exec vp exec node apps/desktop/scripts/start-electron.mjs
