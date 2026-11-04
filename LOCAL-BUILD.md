# T3 Code (Custom)

This checkout tracks https://github.com/pingdotgg/t3code on the local branch
`local/custom`. The branch is also pushed to the fork
https://github.com/zhuasy/t3code (remote `fork`); `update.sh` pushes it again
after each successful rebase and build. The patch limits Pi’s picker to a curated OpenRouter
list excluding Claude, plus Morph DeepSeek Uncensored, and adds bundled company
logos. Other harnesses keep their existing model lists.

The launcher at `/Applications/T3 Code (Custom).app` runs this checkout’s built desktop.
It uses the normal `~/.t3` state and the normal macOS `t3code-v2` desktop profile,
so all existing threads, themes, logins, and settings remain in place. No imports
or history synchronization are needed. Quit the old app and reopen it to switch.
Do not launch another version against the same profile at the same time.

The original official bundle is backed up under `~/Applications/T3 Code Official Backups/`.
The earlier isolated Local profile remains under `~/.t3-local` as a backup.

Use **T3 Code (Custom) → Update Local Build…** in the macOS application menu.
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

To use the build on another Mac, clone the fork and set `origin` to upstream:

```sh
git clone -b local/custom git@github.com:zhuasy/t3code.git ~/workplace/t3code
cd ~/workplace/t3code
git remote rename origin fork
git remote add origin https://github.com/pingdotgg/t3code.git
git fetch origin && git branch -u fork/local/custom
```

On a Mac that only uses the build, take updates with
`git fetch fork && git reset --hard fork/local/custom`. The branch is rebased, so
a plain `git pull` fails. Run `update.sh` on one Mac only, or the two copies diverge.

To restore the official app, quit T3 and move its backed-up bundle back to
`/Applications/T3 Code (Beta).app`.

Devin uses T3’s native ACP Registry adapter. In Settings → Providers → Devin,
select **Devin Cloud** under Execution and leave Executable override empty.
Version presets appear in the model picker. Organization, repositories, persona,
and platform appear as separate options. Devin currently advertises no independent
reasoning-effort control; version presets are not duplicated as an effort setting.
