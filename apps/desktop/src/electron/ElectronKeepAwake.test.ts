import { assert, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { expect, vi } from "vite-plus/test";

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync }));

import * as ElectronKeepAwake from "./ElectronKeepAwake.ts";

const encoder = new TextEncoder();

function makeProcess(stdout: string, stderr = "", exitCode = 0) {
  const text = (value: string) =>
    value.length === 0 ? Stream.empty : Stream.make(encoder.encode(value));
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    stdout: text(stdout),
    stderr: text(stderr),
    all: text(stdout),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stdin: Sink.drain,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    unref: Effect.succeed(Effect.void),
  });
}

function fakePmset(options: { sudoPassword?: boolean; sleepDisabled?: boolean } = {}) {
  const state = { sleepDisabled: options.sleepDisabled ?? false, calls: [] as string[] };
  const layer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (command._tag !== "StandardCommand") return Effect.die("unexpected piped command");
      const line = [command.command, ...command.args].join(" ");
      state.calls.push(line);
      if (line === "/usr/bin/pmset -g") {
        return Effect.succeed(
          makeProcess(` SleepDisabled\t\t${state.sleepDisabled ? 1 : 0}\n sleep  1\n`),
        );
      }
      const match = /^\/usr\/bin\/sudo -n \/usr\/bin\/pmset -a disablesleep ([01])$/.exec(line);
      if (!match) return Effect.die(`unexpected command: ${line}`);
      if (options.sudoPassword) {
        return Effect.succeed(makeProcess("", "sudo: a password is required\n", 1));
      }
      state.sleepDisabled = match[1] === "1";
      return Effect.succeed(makeProcess(""));
    }),
  );
  return { state, layer };
}

it.effect("toggles pmset disablesleep and restores sleep on shutdown", () => {
  const pmset = fakePmset();
  return Effect.gen(function* () {
    yield* Effect.gen(function* () {
      const service = yield* ElectronKeepAwake.make;
      assert.isFalse(yield* service.enabled);
      assert.isTrue(yield* service.setEnabled(true));
      assert.isTrue(pmset.state.sleepDisabled);
      assert.isFalse(yield* service.setEnabled(false));
      assert.isTrue(yield* service.setEnabled(true));
      yield* service.release;
      assert.isFalse(pmset.state.sleepDisabled);
      yield* service.setEnabled(true);
    }).pipe(Effect.scoped);
    assert.isFalse(pmset.state.sleepDisabled);
  }).pipe(Effect.provide(pmset.layer), Effect.provideService(HostProcess.Platform, "darwin"));
});

it.effect("leaves a setting it did not turn on alone at shutdown", () => {
  const pmset = fakePmset({ sleepDisabled: true });
  return Effect.gen(function* () {
    const service = yield* ElectronKeepAwake.make;
    assert.isTrue(yield* service.enabled);
  }).pipe(
    Effect.scoped,
    Effect.tap(() => Effect.sync(() => assert.isTrue(pmset.state.sleepDisabled))),
    Effect.provide(pmset.layer),
    Effect.provideService(HostProcess.Platform, "darwin"),
  );
});

it.effect("explains the sudoers rule when sudo needs a password", () => {
  const pmset = fakePmset({ sudoPassword: true });
  return Effect.gen(function* () {
    const service = yield* ElectronKeepAwake.make;
    const error = yield* Effect.flip(service.setEnabled(true));
    assert.include(error.message, "sudoers rule");
    assert.isFalse(yield* service.enabled);
  }).pipe(
    Effect.scoped,
    Effect.provide(pmset.layer),
    Effect.provideService(HostProcess.Platform, "darwin"),
  );
});

it.effect("does not run pmset on other platforms", () => {
  const pmset = fakePmset();
  return Effect.gen(function* () {
    const service = yield* ElectronKeepAwake.make;
    assert.equal((yield* Effect.flip(service.setEnabled(true)))._tag, "KeepAwakeError");
    assert.isFalse(yield* service.enabled);
    assert.deepEqual(pmset.state.calls, []);
  }).pipe(
    Effect.scoped,
    Effect.provide(pmset.layer),
    Effect.provideService(HostProcess.Platform, "linux"),
  );
});

it.effect("restores its own setting from the exit hook when quit skips finalizers", () => {
  const pmset = fakePmset();
  return Effect.gen(function* () {
    execFileSync.mockReset();
    const before = new Set(process.listeners("exit"));
    const service = yield* ElectronKeepAwake.make;
    const hooks = process.listeners("exit").filter((listener) => !before.has(listener));
    assert.equal(hooks.length, 1);
    const exitHook = hooks[0] as () => void;

    exitHook();
    expect(execFileSync).not.toHaveBeenCalled();

    yield* service.setEnabled(true);
    exitHook();
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "/usr/bin/sudo",
      ["-n", "/usr/bin/pmset", "-a", "disablesleep", "0"],
      expect.anything(),
    );
    exitHook();
    expect(execFileSync).toHaveBeenCalledOnce();
  }).pipe(
    Effect.scoped,
    Effect.provide(pmset.layer),
    Effect.provideService(HostProcess.Platform, "darwin"),
  );
});
