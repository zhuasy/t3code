# T3 Code Local

This checkout tracks https://github.com/pingdotgg/t3code on the local branch
`local/openrouter-picker`. The patch limits Pi’s picker to OpenRouter and adds
bundled company logos. Other harnesses keep their existing model lists.

Open `~/Applications/T3 Code Local.app`, or run `scripts/local-openrouter/start.sh`.
It uses `~/.t3-local`, including a separate Electron profile. The official app
keeps its existing state. On each launch, Local imports Beta’s preferences,
providers, model settings, shortcuts, desktop settings, and custom themes.
Beta is the source of truth: Local settings edits do not write back to Beta, and
the next launch imports Beta again. Previous Local settings are backed up under
`~/.t3-local/settings-backups`.

Recent stopped threads were copied once; the two apps do not synchronize history.
Provider CLI authentication, including Pi’s `~/.pi`, is already shared. Each app
keeps its own desktop login and remote-connection identity.

Use **T3 Code Local → Update Local Build…** in the macOS application menu.
It checks upstream, then offers **Update and Restart**. Finish active agent
sessions before installing; the build runs in Terminal and reopens the app on success.

Daily checks run at 10:00 local time through a macOS LaunchAgent. Checks only
refresh remote Git refs and write `~/.t3-local/source-update-status.json`; they
do not rebase, rebuild, or restart the app. Checks run when the Mac wakes if it
was asleep at the scheduled time.

To change the schedule, run `scripts/local-openrouter/automate.sh weekly`
or `scripts/local-openrouter/automate.sh off`. Run `check.sh` from that folder
for a manual check.

To update from a terminal, quit the local app and run:

```sh
cd ~/workplace/t3code
scripts/local-openrouter/update.sh
```

This fetches upstream main, rebases the local commits, installs pinned dependencies,
runs the focused picker and profile-isolation tests, and rebuilds the desktop app.
It stops on a conflict or failed check. For a rebase conflict, resolve it and run
`git rebase --continue`, or use `git rebase --abort` to keep the previous source.
Then rerun the update script. No automatic binary updater runs in this unpackaged build.

The official app remains available under `/Applications/T3 Code (Beta).app`.
