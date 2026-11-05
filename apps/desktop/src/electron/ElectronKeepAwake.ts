// @effect-diagnostics nodeBuiltinImport:off -- The exit hook must finish synchronously; an async child cannot.
import * as NodeChildProcess from "node:child_process";

import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

export class KeepAwakeError extends Schema.TaggedError<KeepAwakeError>()("KeepAwakeError", {
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    return this.detail;
  }
}

export class ElectronKeepAwake extends Context.Service<
  ElectronKeepAwake,
  {
    readonly enabled: Effect.Effect<boolean, KeepAwakeError>;
    readonly setEnabled: (enabled: boolean) => Effect.Effect<boolean, KeepAwakeError>;
    /** Restores sleep if this app disabled it. */
    readonly release: Effect.Effect<void>;
  }
>()("@t3tools/desktop/electron/ElectronKeepAwake") {}

// Needs the sudoers rule from LOCAL-BUILD.md, "Install on a new Mac" step 6.
const SUDO_HINT =
  "sudo needs a password for pmset. Add the sudoers rule from LOCAL-BUILD.md step 6, then try again.";

export const make = Effect.gen(function* () {
  const platform = yield* HostProcess.Platform;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  let turnedOnHere = false;

  const run = (command: string, args: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(command, args, { stdin: "ignore", stderr: "pipe" }),
        );
        const [stdout, stderr, code] = yield* Effect.all(
          [
            handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
            handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
            handle.exitCode,
          ],
          { concurrency: "unbounded" },
        );
        return { stdout, stderr: stderr.trim(), code };
      }),
    ).pipe(
      Effect.mapError(
        (cause) => new KeepAwakeError({ detail: `Could not run ${command}.`, cause }),
      ),
    );

  const enabled = Effect.gen(function* () {
    if (platform !== "darwin") return false;
    const result = yield* run("/usr/bin/pmset", ["-g"]);
    if (result.code !== 0) {
      return yield* new KeepAwakeError({ detail: result.stderr || "pmset -g failed." });
    }
    return /^\s*SleepDisabled\s+1\s*$/m.test(result.stdout);
  }).pipe(Effect.withSpan("ElectronKeepAwake.enabled"));

  const setEnabled = Effect.fn("ElectronKeepAwake.setEnabled")(function* (on: boolean) {
    if (platform !== "darwin") {
      return yield* new KeepAwakeError({
        detail: "Keeping this Mac awake is only available on macOS.",
      });
    }
    const result = yield* run("/usr/bin/sudo", [
      "-n",
      "/usr/bin/pmset",
      "-a",
      "disablesleep",
      on ? "1" : "0",
    ]);
    if (result.code !== 0) {
      return yield* new KeepAwakeError({
        detail: /password/i.test(result.stderr)
          ? SUDO_HINT
          : result.stderr || result.stdout.trim() || "pmset failed.",
      });
    }
    turnedOnHere = on;
    return on;
  });

  const release = Effect.suspend(() =>
    turnedOnHere
      ? setEnabled(false).pipe(
          Effect.asVoid,
          Effect.catch((error) => Effect.logWarning(error)),
        )
      : Effect.void,
  );

  yield* Effect.addFinalizer(() => release);

  // The flag outlives the process. A stalled quit ends in `app.exit`, which skips every
  // finalizer, but Electron still emits process "exit", and a sync call there completes.
  const releaseAtExit = () => {
    if (!turnedOnHere) return;
    try {
      NodeChildProcess.execFileSync(
        "/usr/bin/sudo",
        ["-n", "/usr/bin/pmset", "-a", "disablesleep", "0"],
        { stdio: "ignore", timeout: 5_000 },
      );
      turnedOnHere = false;
    } catch {
      // Nothing left to try at exit; the icon shows the flag on the next launch.
    }
  };
  yield* Effect.acquireRelease(
    Effect.sync(() => process.on("exit", releaseAtExit)),
    () => Effect.sync(() => process.off("exit", releaseAtExit)),
  );

  return ElectronKeepAwake.of({ enabled, setEnabled, release });
});

export const layer = Layer.effect(ElectronKeepAwake, make);
