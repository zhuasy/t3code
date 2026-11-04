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
It checks for a newer stable upstream release (a `v*` tag without a suffix), then
offers **Update and Restart**. Finish active agent
sessions before installing; the build runs in Terminal and reopens the app on success.

Daily checks run at 10:00 local time through a macOS LaunchAgent. Checks only
refresh remote Git refs and show a macOS notification when a newer release exists;
they do not rebase, rebuild, or restart the app. Checks run when the Mac wakes if it
was asleep at the scheduled time.

To change the schedule, run `scripts/local-openrouter/automate.sh weekly`
or `scripts/local-openrouter/automate.sh off`. Run `check.sh` from that folder
for a manual check.

To update from a terminal, quit the local app and run:

```sh
cd ~/workplace/t3code
scripts/local-openrouter/update.sh
```

This waits for the app to stop, fetches upstream, and rebases the local commits onto
the latest stable release tag. It never moves to a release older than the current
upstream base, so a build taken from a newer `main` waits for the next release. It then
installs pinned dependencies, checks the fork’s changed files and affected packages,
and rebuilds the desktop app. It stops on a conflict or failed check.

For a rebase conflict, resolve it, run `git rebase --continue`, and rerun the update
script to build the result. Or run `git rebase --abort`: the previous source and build
stay in place and the app starts as before. A failed fetch also changes nothing.
After a failed install, check, or build, the launcher refuses to start until the update
script succeeds; it does not reset your changes. `~/.t3-local/source-built-head` records
the commit of the last successful build. No automatic binary updater runs in this
unpackaged build.

## Install on a new Mac

You need macOS on Apple Silicon, Git, and SSH access to the fork. Then:

1. Install the official app. The launcher is made from its bundle, and it creates the
   `~/.t3` profile on first launch:

   ```sh
   brew install --cask t3-code   # installs /Applications/T3 Code (Beta).app
   ```

2. Install `vp`, the Vite+ CLI. It supplies the pinned Node, so you do not need a
   separate Node install. Open a new terminal after this step:

   ```sh
   curl -fsSL https://vite.plus | bash
   ```

3. Clone the fork, and set `origin` to upstream so updates rebase onto it:

   ```sh
   git clone -b local/custom git@github.com:zhuasy/t3code.git ~/workplace/t3code
   cd ~/workplace/t3code
   git remote rename origin fork
   git remote add origin https://github.com/pingdotgg/t3code.git
   git fetch origin && git branch -u fork/local/custom
   ```

4. Install dependencies and build the desktop app (this takes several minutes):

   ```sh
   vp i --frozen-lockfile
   vp run build:desktop
   ```

5. Quit T3 Code, then install the launcher. It backs up the official bundle and your
   database to `~/Applications/T3 Code Official Backups/`:

   ```sh
   scripts/local-openrouter/install.sh
   ```

6. Optional: let the sidebar coffee button run `pmset` without a password:

   ```sh
   tmp=$(mktemp)
   echo "$USER ALL=(root) NOPASSWD: /usr/bin/pmset -a disablesleep 0, /usr/bin/pmset -a disablesleep 1" >"$tmp"
   sudo visudo -cf "$tmp" && sudo install -m 0440 -o root -g wheel "$tmp" /etc/sudoers.d/t3code-pmset
   rm "$tmp"
   ```

7. Optional: turn on daily update checks with `scripts/local-openrouter/automate.sh daily`.
8. Open **T3 Code (Custom)** from `/Applications`. If it does not start, read
   `~/.t3-local/desktop.log`.

The launcher runs this checkout in place. Do not move or delete the checkout. If you
move it, run `install.sh` again to repair the launcher.

On a Mac that only uses the build, take updates with
`git fetch fork && git reset --hard fork/local/custom`. The branch is rebased, so
a plain `git pull` fails. Run `update.sh` on one Mac only, or the two copies diverge.

To restore the official app, quit T3 and move its backed-up bundle back to
`/Applications/T3 Code (Beta).app`.

## Devin

Devin uses T3’s native ACP Registry adapter. In Settings → Providers → Devin,
select **Devin Cloud** under Execution and leave Executable override empty.
Version presets appear in the model picker. Organization, repositories, persona,
and platform appear as separate options. Devin currently advertises no independent
reasoning-effort control; version presets are not duplicated as an effort setting.
