#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
agent_id="com.zhuasy.t3code.local-update-check"
agent_file="$HOME/Library/LaunchAgents/$agent_id.plist"
if [[ "${1:-}" == "off" ]]; then
  launchctl bootout "gui/$(id -u)/$agent_id" 2>/dev/null || true
  rm -f "$agent_file"
  echo "Automatic local update checks disabled."
  exit 0
fi
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.t3-local"
python3 - "$agent_file" "$PWD" "$HOME" "${1:-daily}" <<'PY'
import pathlib, plistlib, sys
file, repo, home, frequency = sys.argv[1:]
if frequency not in ('daily', 'weekly'):
    raise SystemExit('Choose daily, weekly, or off.')
schedule = dict(Hour=10, Minute=0)
if frequency == 'weekly':
    schedule['Weekday'] = 1
job = dict(Label='com.zhuasy.t3code.local-update-check',
           ProgramArguments=['/bin/bash', f'{repo}/scripts/local-openrouter/check.sh'],
           WorkingDirectory=repo,
           EnvironmentVariables=dict(PATH='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', HOME=home,
                                     T3CODE_NOTIFY='1'),
           StartCalendarInterval=schedule, ProcessType='Background',
           StandardOutPath=f'{home}/.t3-local/source-update-check.log',
           StandardErrorPath=f'{home}/.t3-local/source-update-check.error.log')
pathlib.Path(file).write_bytes(plistlib.dumps(job))
PY
launchctl bootout "gui/$(id -u)/$agent_id" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$agent_file"
echo "Automatic checks enabled (${1:-daily}, 10:00 local time). Installation stays manual."
