#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
log_dir="${T3CODE_LOCAL_HOME:-$HOME/.t3-local}"
mkdir -p "$log_dir"
if scripts/local-openrouter/update.sh 2>&1 | tee "$log_dir/source-update-install.log"; then
  /usr/bin/open "/Applications/T3 Code (Beta).app"
else
  echo "Update stopped. Your local patch and diagnostic output are in the checkout and log above."
  echo "Press Return to close this window."
  read -r _
  exit 1
fi
