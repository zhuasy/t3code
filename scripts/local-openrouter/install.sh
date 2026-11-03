#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
repo_root="$PWD"
launcher_app="$HOME/Applications/T3 Code Local.app"
if [[ -e "$launcher_app" ]]; then
  echo "Launcher already exists: $launcher_app" >&2
  exit 1
fi
mkdir -p "$launcher_app/Contents/MacOS" "$launcher_app/Contents/Resources"
cat > "$launcher_app/Contents/MacOS/launch" <<LAUNCH
#!/bin/bash
mkdir -p "\$HOME/.t3-local"
exec "$repo_root/scripts/local-openrouter/start.sh" >> "\$HOME/.t3-local/desktop.log" 2>&1
LAUNCH
chmod +x "$launcher_app/Contents/MacOS/launch"
cat > "$launcher_app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>launch</string>
<key>CFBundleIdentifier</key><string>com.zhuasy.t3code.local-launcher</string>
<key>CFBundleName</key><string>T3 Code Local</string>
<key>CFBundleDisplayName</key><string>T3 Code Local</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleIconFile</key><string>icon.icns</string>
</dict></plist>
PLIST
cp "$repo_root/apps/desktop/.electron-runtime/icon-prod.icns" "$launcher_app/Contents/Resources/icon.icns"
codesign --force --sign - "$launcher_app"
echo "Installed $launcher_app"
