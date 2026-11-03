#!/usr/bin/env python3
import argparse
import datetime
import json
import pathlib
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=pathlib.Path, required=True)
parser.add_argument('--target', type=pathlib.Path, required=True)
args = parser.parse_args()
source, target = args.source.expanduser().resolve(), args.target.expanduser().resolve()
if source == target:
    raise SystemExit('The local profile must be separate from the Beta profile.')
target.mkdir(parents=True, exist_ok=True)
backup = target.parent / 'settings-backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
files = ['settings.json', 'client-settings.json', 'desktop-settings.json',
         'keybindings.json', 'keybindings-migrations', 'model-manifest.json',
         'usage-model-rates.json']
files += [str(p.relative_to(source)) for p in (source / 'themes').rglob('*') if p.is_file()]
for name in files:
    original, destination = source / name, target / name
    if not original.is_file():
        continue
    content = original.read_bytes()
    if original.suffix == '.json':
        json.loads(content)
    if destination.exists() and destination.read_bytes() == content:
        continue
    if destination.exists():
        previous = backup / name
        previous.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destination, previous)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.importing')
    temporary.write_bytes(content)
    temporary.chmod(0o600)
    temporary.replace(destination)
print('Imported Beta settings into the local profile; session data was not copied.')
