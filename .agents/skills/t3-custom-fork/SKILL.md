---
name: t3-custom-fork
description: Build, update, install, or troubleshoot the macOS T3 Code Custom source fork on local/custom, including its launcher, existing profile, source-update menu, scheduled update checks, and keep-awake toggle. Also use to find the skill for a fork-specific feature or audit coverage after upstream updates.
---

# T3 Code Custom

Read [LOCAL-BUILD.md](../../../LOCAL-BUILD.md) and the relevant script before operating
the installed app. Run repository commands from this checkout's root. Confirm the
branch and inspect the working tree first; other agents may have uncommitted work.

## Build, update, and install are different operations

| Request                           | Workflow                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build the current source          | Run `vp run build:desktop`, preferably through [managed Jobs](../t3-managed-jobs/SKILL.md). This builds web, the bundled server, and Electron. Report the result; the running app still needs a relaunch to use it.                                                                                                                           |
| Check for fork updates            | `bash scripts/local-openrouter/check.sh` fetches `fork/local/custom` and reports new commits. It does not rebase, build, or restart.                                                                                                                                                                                                          |
| Update the installed source build | Review `scripts/local-openrouter/update.sh` first. It requires a clean `local/custom`, fast-forwards to `fork/local/custom` (never upstream), installs dependencies, builds, and **pushes local commits the fork lacks**. Only use the whole script when that full scope is authorized. A no-push request requires separate authorized steps. |
| Repair/install the launcher       | Read `scripts/local-openrouter/install.sh` first; it replaces an app bundle and backs up the previous one. Run only for an installation/repair request, not for ordinary code changes.                                                                                                                                                        |
| Schedule update checks            | `bash scripts/local-openrouter/automate.sh daily` or `weekly`; `off` removes the check. These schedule checks at 10:00 local time, not unattended updates.                                                                                                                                                                                    |

The desktop menu **T3 Code (Custom) → Update Local Build…** provides the update flow.
This source build does not use normal packaged binary updates. Do not use the
update script as a shortcut for build-only work, stash someone else's edits, reset
the branch to get a clean tree, push without authorization, or terminate the app
that is hosting the current conversation.

The installer can start from the official **T3 Code (Beta)** app when no
Custom bundle exists. Rerunning it repairs the launcher after the source checkout
moves; it backs up the previous bundle instead of silently reusing its old path.
Do not test installation by replacing the live app: use an isolated fixture for
script behavior, and distinguish stubbed signing checks from a real signed install.

A failed source update leaves a `source-update-incomplete` marker. The launcher
refuses to start while that marker, the update lock, or an unfinished rebase exists.
Resolve the reported conflict/check/build failure and finish the authorized update;
only a successful build in that flow clears the marker. Do not delete the guards
to launch an incomplete update or use a destructive reset as routine recovery.

The launcher is `/Applications/T3 Code (Custom).app`; `start.sh` starts this
checkout's Electron build. The normal app preserves the existing `~/.t3` data and
`t3code-v2` desktop profile. `~/.t3-local` holds local update status/logs and may also
contain an old isolated profile; it is not the default live data directory.
Development servers must use isolated checkout state, never the live database.

For an authorized commit, stage only paths or hunks you changed and use a
conventional commit title on `local/custom`. Coordinate commits in a shared checkout,
use a separate Git index when other agents are active, and inspect the resulting
commit's paths after hooks run. A build succeeding is not a claim that the running
app has reloaded it.

## Keep this Mac awake

The coffee control at the bottom of the desktop sidebar toggles **Keep this Mac
awake**. It runs `sudo -n pmset -a disablesleep 1|0` and reads `SleepDisabled` from
`pmset -g`, so the Mac stays awake with the lid closed; the display may still sleep.
A quit restores sleep only if the button disabled it, also when a stalled quit ends
in `app.exit`. A crash leaves sleep disabled. The icon re-reads the flag on window
focus, so a change from a terminal or a crash shows up. It is a macOS desktop control, not a remote-host setting or web control.
Do not start a `caffeinate` process to duplicate it.

The button needs the passwordless sudoers rule in LOCAL-BUILD.md. A "sudo needs a
password" toast means the rule is missing. If the button is unavailable after a
build, check that the new Electron main process is running; a web reload alone
does not refresh desktop IPC. The implementation is
[ElectronKeepAwake](../../../apps/desktop/src/electron/ElectronKeepAwake.ts) and
[SidebarKeepAwake](../../../apps/web/src/components/sidebar/SidebarKeepAwake.tsx).

## Fork feature coverage

Use these skills for the fork's workflows; automatic fixes belong with the feature
they protect, rather than requiring a separate invocation per fix.

| Feature family                                                                                                                  | Skill                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Persistent macOS shell commands, titles, colored output, restart recovery, stop and resource limits                             | [Managed Jobs](../t3-managed-jobs/SKILL.md)         |
| Devin Cloud/Local, login, model presets/options, account usage, native sessions/subagents, hosted PR reviews                    | [Devin](../t3-devin/SKILL.md)                       |
| Curated Pi models, full names, company logos, OpenRouter spend limits                                                           | [Pi/OpenRouter](../t3-pi-openrouter/SKILL.md)       |
| Theme previews, minimal notifications, usage defaults, project ordering, message continuity, native rename and Claude streaming | [Custom interface](../t3-custom-interface/SKILL.md) |
| Custom app identity/profile, build/launcher, update menu/checks, keep-awake                                                     | This skill                                          |

Keep the skills in `.agents/skills` versioned with the fork. This checkout's
`.claude/skills` symlink exposes the same files to Claude; Codex discovers the
repository skill directory. Other providers have their own discovery rules. Do not
claim global installation or universal provider loading merely because a skill file
exists. Jobs' default-use guidance is also in the shared provider base instructions.

When auditing after an upstream update, compare the fork's net diff with its upstream
base and read the affected source. Update the relevant skill when a workflow changes;
do not turn reverted experiments, dependency cleanup, or test-only changes into new
user features. Existing [app](../test-t3-app/SKILL.md) and
[mobile](../test-t3-mobile/SKILL.md) testing skills remain the verification entry points.
