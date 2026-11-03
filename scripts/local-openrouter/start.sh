#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$PATH"
export T3CODE_HOME="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}"
unset VITE_DEV_SERVER_URL ELECTRON_RUN_AS_NODE
exec vp exec node apps/desktop/scripts/start-electron.mjs
