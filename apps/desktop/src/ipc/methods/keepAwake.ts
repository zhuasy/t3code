import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Electron from "electron";

import * as ElectronKeepAwake from "../../electron/ElectronKeepAwake.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

export const getKeepAwake = makeIpcMethod({
  channel: IpcChannels.GET_KEEP_AWAKE_CHANNEL,
  payload: Schema.Void,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.keepAwake.get")(function* () {
    return yield* (yield* ElectronKeepAwake.ElectronKeepAwake).enabled;
  }),
});

export const setKeepAwake = makeIpcMethod({
  channel: IpcChannels.SET_KEEP_AWAKE_CHANNEL,
  payload: Schema.Boolean,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.keepAwake.set")(function* (enabled) {
    const state = yield* (yield* ElectronKeepAwake.ElectronKeepAwake).setEnabled(enabled);
    for (const window of Electron.BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IpcChannels.KEEP_AWAKE_CHANGED_CHANNEL, state);
      }
    }
    return state;
  }),
});
