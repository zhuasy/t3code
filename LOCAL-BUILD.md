# T3 Code Local

This checkout tracks https://github.com/pingdotgg/t3code on the local branch
`local/openrouter-picker`. The patch limits Pi’s picker to OpenRouter and adds
bundled company logos. Other harnesses keep their existing model lists.

Open `~/Applications/T3 Code Local.app`, or run `scripts/local-openrouter/start.sh`.
It uses `~/.t3-local`, including a separate Electron profile. The official app
keeps its existing state. Recent stopped threads were copied once; the two apps
do not synchronize history. Pi uses its existing authentication in `~/.pi`.

To update, quit the local app and run:

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
