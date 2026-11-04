import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { Atom } from "effect/reactivity";

export function getDesktopKeepAwakeBridge() {
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  return bridge?.getClientPlatform() === "darwin" && typeof bridge.getKeepAwake === "function"
    ? bridge
    : undefined;
}

export const desktopKeepAwakeAtom = Atom.make(
  Stream.callback<boolean, unknown>((queue) =>
    Effect.gen(function* () {
      const bridge = getDesktopKeepAwakeBridge();
      if (!bridge) return yield* Effect.never;
      let receivedUpdate = false;
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          bridge.onKeepAwakeChanged((enabled) => {
            receivedUpdate = true;
            Queue.offerUnsafe(queue, enabled);
          }),
        ),
        (unsubscribe) => Effect.sync(unsubscribe),
      );
      const enabled = yield* Effect.tryPromise(() => bridge.getKeepAwake());
      // A change delivered while the initial read was in flight is newer than that read.
      if (!receivedUpdate) Queue.offerUnsafe(queue, enabled);
      return yield* Effect.never;
    }),
  ),
).pipe(Atom.withLabel("desktop:keep-awake"));
