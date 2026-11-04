#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
repo_root="$PWD"
launcher_app="/Applications/T3 Code (Custom).app"
source_app="$launcher_app"
if [[ ! -d "$source_app" ]]; then
  source_app="/Applications/T3 Code (Beta).app"
fi
stamp="$(date +%Y%m%d-%H%M%S)-$$"
staged_app="/Applications/.T3-Code-source-$stamp.app"
backup_dir="$HOME/Applications/T3 Code Official Backups"
backup_app="$backup_dir/$(basename "$source_app" .app)-$stamp.app"
if [[ ! -d "$source_app" ]]; then
  echo "Install the official T3 Code (Beta) app before installing the source launcher." >&2
  exit 1
fi
mkdir -p "$backup_dir"
python3 - "$HOME/.t3/userdata/statev2.sqlite" "$backup_dir/state-before-source-$stamp.sqlite" <<'PYBACKUP'
import pathlib, sqlite3, sys
source, destination = map(pathlib.Path, sys.argv[1:])
if source.is_file():
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as original:
        with sqlite3.connect(destination) as backup:
            original.backup(backup)
    destination.chmod(0o600)
    print(f'Existing database backup: {destination}')
PYBACKUP
ditto "$source_app" "$staged_app"
cat > "$staged_app/Contents/MacOS/T3SourceLauncher" <<LAUNCH
#!/bin/bash
mkdir -p "\$HOME/.t3-local"
exec "$repo_root/scripts/local-openrouter/start.sh" >> "\$HOME/.t3-local/desktop.log" 2>&1
LAUNCH
chmod +x "$staged_app/Contents/MacOS/T3SourceLauncher"
/usr/libexec/PlistBuddy -c 'Set :CFBundleExecutable T3SourceLauncher' "$staged_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleName T3 Code (Custom)' "$staged_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName T3 Code (Custom)' "$staged_app/Contents/Info.plist"
if /usr/libexec/PlistBuddy -c 'Print :T3SourceCheckout' "$staged_app/Contents/Info.plist" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Set :T3SourceCheckout $repo_root" "$staged_app/Contents/Info.plist"
else
  /usr/libexec/PlistBuddy -c "Add :T3SourceCheckout string $repo_root" "$staged_app/Contents/Info.plist"
fi
codesign --force --deep --sign - "$staged_app"
codesign --verify --deep "$staged_app"
mv "$source_app" "$backup_app"
if ! mv "$staged_app" "$launcher_app"; then
  mv "$backup_app" "$source_app"
  exit 1
fi
printf 'Installed launcher: %s\nPrevious bundle backup: %s\nQuit and reopen T3 to use the source build with your existing profile.\n' "$launcher_app" "$backup_app"
