import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Electron from "electron";

export class KeepAwakeError extends Schema.TaggedError<KeepAwakeError>()("KeepAwakeError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Could not change whether this Mac stays awake.";
  }
}

export class ElectronKeepAwake extends Context.Service<
  ElectronKeepAwake,
  {
    readonly enabled: Effect.Effect<boolean>;
    readonly setEnabled: (enabled: boolean) => Effect.Effect<boolean, KeepAwakeError>;
  }
>()("@t3tools/desktop/electron/ElectronKeepAwake") {}

export const make = Effect.gen(function* () {
  const platform = yield* HostProcess.Platform;
  let blockerId: number | undefined;

  const setEnabled = Effect.fn("ElectronKeepAwake.setEnabled")(function (enabled: boolean) {
    return Effect.try({
      try: () => {
        if (enabled && platform !== "darwin") {
          throw new Error("Keeping this Mac awake is only available on macOS.");
        }
        if (enabled && blockerId === undefined) {
          blockerId = Electron.powerSaveBlocker.start("prevent-app-suspension");
        } else if (!enabled && blockerId !== undefined) {
          Electron.powerSaveBlocker.stop(blockerId);
          blockerId = undefined;
        }
        return blockerId !== undefined;
      },
      catch: (cause) => new KeepAwakeError({ cause }),
    });
  });

  yield* Effect.addFinalizer(() =>
    setEnabled(false).pipe(Effect.catch((error) => Effect.logWarning(error))),
  );

  return ElectronKeepAwake.of({
    enabled: Effect.sync(() => blockerId !== undefined),
    setEnabled,
  });
});

export const layer = Layer.effect(ElectronKeepAwake, make);
