#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$PATH"
if [[ "$(git branch --show-current)" != "local/openrouter-picker" ]]; then
  echo "Switch to local/openrouter-picker before updating." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash local changes before updating." >&2
  exit 1
fi
git fetch origin main
git rebase origin/main
vp i --frozen-lockfile
vp test run apps/web/src/components/chat/ProviderModelPicker.browser.test.tsx apps/web/src/components/chat/modelPickerSearch.test.ts apps/web/src/components/chat/ProviderInstanceIcon.test.ts apps/desktop/src/app/DesktopEnvironment.test.ts
vp run build:desktop
echo "Updated and rebuilt. Quit T3 Code Local, then open it again."
