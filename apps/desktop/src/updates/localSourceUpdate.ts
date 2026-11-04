import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";

export class LocalSourceUpdateError extends Schema.TaggedError<LocalSourceUpdateError>()(
  "LocalSourceUpdateError",
  { cause: Schema.Defect() },
) {}

export const checkLocalSourceUpdate = Effect.fn("desktop.localSourceUpdate.check")(function* (
  rootDir: string,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const dialog = yield* ElectronDialog.ElectronDialog;
  const app = yield* ElectronApp.ElectronApp;
  const detail = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make("/bin/bash", [`${rootDir}/scripts/local-openrouter/check.sh`], {
          stdin: "ignore",
          stderr: "pipe",
          extendEnv: true,
        }),
      );
      const [stdout, stderr, code] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
          handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: "unbounded" },
      );
      if (code !== 0) return yield* Effect.fail(stderr.trim() || "The update check failed.");
      return stdout.trim();
    }).pipe(Effect.timeout("45 seconds")),
  ).pipe(
    Effect.mapError((cause) => new LocalSourceUpdateError({ cause })),
    Effect.result,
  );
  if (detail._tag === "Failure") {
    yield* dialog.showMessageBox({
      type: "warning",
      title: "Local update check failed",
      message: "Could not check upstream releases.",
      detail: String(detail.failure.cause),
      buttons: ["OK"],
    });
    return;
  }
  const choice = yield* dialog.showMessageBox({
    type: "info",
    title: "T3 Code (Custom) updates",
    message: detail.success,
    detail:
      "Update quits the local app, rebases your patch onto the latest upstream release, runs checks, and rebuilds in Terminal. The app reopens when the build succeeds. Finish active agent sessions first.",
    buttons: ["Later", "Update and Restart"],
    defaultId: 0,
    cancelId: 0,
  });
  if (choice.response !== 1) return;
  yield* app.relaunch({
    execPath: "/usr/bin/open",
    args: ["-a", "Terminal", `${rootDir}/scripts/local-openrouter/update.command`],
  });
  yield* app.quit;
});
