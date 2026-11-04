import { assert, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import { expect, vi } from "vite-plus/test";

const { powerSaveBlocker } = vi.hoisted(() => ({
  powerSaveBlocker: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock("electron", () => ({ powerSaveBlocker }));

import * as ElectronKeepAwake from "./ElectronKeepAwake.ts";

function setup() {
  const active = new Set<number>();
  let nextId = 0;
  powerSaveBlocker.start.mockReset().mockImplementation(() => {
    const id = nextId++;
    active.add(id);
    return id;
  });
  powerSaveBlocker.stop.mockReset().mockImplementation((id: number) => active.delete(id));
  return active;
}

it.effect("owns one idle-sleep blocker across repeated toggles and releases it on shutdown", () =>
  Effect.gen(function* () {
    const active = setup();
    yield* Effect.gen(function* () {
      const service = yield* ElectronKeepAwake.make;
      assert.isFalse(yield* service.enabled);
      assert.isFalse(yield* service.setEnabled(false));
      assert.isTrue(yield* service.setEnabled(true));
      assert.isTrue(yield* service.setEnabled(true));
      assert.equal(active.size, 1);
      expect(powerSaveBlocker.start).toHaveBeenCalledExactlyOnceWith("prevent-app-suspension");
      assert.isTrue(yield* service.enabled);

      assert.isFalse(yield* service.setEnabled(false));
      assert.isFalse(yield* service.setEnabled(false));
      assert.equal(active.size, 0);
      expect(powerSaveBlocker.stop).toHaveBeenCalledExactlyOnceWith(0);
      yield* service.setEnabled(true);
      assert.equal(active.size, 1);
    }).pipe(Effect.scoped);
    assert.equal(active.size, 0);
    expect(powerSaveBlocker.stop).toHaveBeenLastCalledWith(1);
  }).pipe(Effect.provideService(HostProcess.Platform, "darwin")),
);

it.effect("retains the actual state when native changes fail and permits retry", () =>
  Effect.gen(function* () {
    const active = setup();
    const service = yield* ElectronKeepAwake.make;
    powerSaveBlocker.start.mockImplementationOnce(() => {
      throw new Error("start failed");
    });
    assert.equal((yield* Effect.flip(service.setEnabled(true)))._tag, "KeepAwakeError");
    assert.isFalse(yield* service.enabled);
    yield* service.setEnabled(true);

    powerSaveBlocker.stop.mockImplementationOnce(() => {
      throw new Error("stop failed");
    });
    assert.equal((yield* Effect.flip(service.setEnabled(false)))._tag, "KeepAwakeError");
    assert.isTrue(yield* service.enabled);
    assert.equal(active.size, 1);
    yield* service.setEnabled(false);
    assert.isFalse(yield* service.enabled);
    assert.equal(active.size, 0);
  }).pipe(Effect.scoped, Effect.provideService(HostProcess.Platform, "darwin")),
);

it.effect("does not acquire a Mac sleep blocker on other platforms", () =>
  Effect.gen(function* () {
    setup();
    for (const platform of ["linux", "win32"] as const) {
      const service = yield* ElectronKeepAwake.make.pipe(
        Effect.provideService(HostProcess.Platform, platform),
      );
      assert.equal((yield* Effect.flip(service.setEnabled(true)))._tag, "KeepAwakeError");
      assert.isFalse(yield* service.enabled);
    }
    expect(powerSaveBlocker.start).not.toHaveBeenCalled();
  }).pipe(Effect.scoped),
);
