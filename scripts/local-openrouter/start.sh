#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$PATH"
export T3CODE_HOME="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}"
python3 scripts/local-openrouter/syncSettings.py --source "${T3CODE_SETTINGS_SOURCE:-$HOME/.t3/userdata}" --target "$T3CODE_HOME/userdata"
unset VITE_DEV_SERVER_URL ELECTRON_RUN_AS_NODE
exec vp exec node apps/desktop/scripts/start-electron.mjs
