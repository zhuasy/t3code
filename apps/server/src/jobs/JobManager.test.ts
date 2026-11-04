import { JOB_TAIL_BYTES } from "./limits.ts";
import { expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  JobError,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationV2ThreadProjection,
  type OrchestrationV2AppThread,
} from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as DateTime from "effect/DateTime";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as JobManager from "./JobManager.ts";
import { JobResult } from "./protocol.ts";
import * as ServerConfig from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";

const encodeResult = Schema.encodeSync(Schema.fromJsonString(JobResult));

const fixture = Effect.fn("jobs.test.fixture")(function* (platform: NodeJS.Platform = "darwin") {
  const fs = yield* FileSystem.FileSystem;
  const baseDir = yield* fs.makeTempDirectoryScoped();
  const config = yield* ServerConfig.ServerConfig.pipe(
    Effect.provide(ServerConfig.layerTest(baseDir, baseDir)),
  );
  const stateDir = config.stateDir;
  const now = DateTime.makeUnsafe(0);
  const threadId = ThreadId.make("job-thread");
  const projectId = ProjectId.make("job-project");
  const instanceId = ProviderInstanceId.make("codex");
  const thread: OrchestrationV2AppThread = {
    id: threadId,
    projectId,
    title: "Jobs",
    createdBy: "user",
    creationSource: "web",
    providerInstanceId: instanceId,
    modelSelection: { instanceId, model: "test" },
    runtimeMode: "full-access",
    interactionMode: "default",
    worktreePath: null,
    branch: null,
    activeProviderThreadId: null,
    lineage: { parentThreadId: null, rootThreadId: threadId, relationshipToParent: null },
    forkedFrom: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    settledAt: null,
    settledOverride: null,
    lastVisitedAt: null,
  };
  const units = new Set<string>();
  const launches: string[] = [];
  const stops: string[] = [];
  let bootId = "boot-a";
  let finishingJobId: string | undefined;
  let archived = false;
  let rotateOnOpen = false;
  let failBootstrap: "before" | "after" | undefined;
  let inspections = 0;
  const output = (stdout = "", code = 0): ProcessRunner.ProcessRunOutput => ({
    stdout,
    stderr: "",
    code: ChildProcessSpawner.ExitCode(code),
    timedOut: false,
    stdoutTruncated: false,
    stderrTruncated: false,
    stdoutInvalidUtf8: false,
    stderrInvalidUtf8: false,
  });
  const runner = Layer.succeed(ProcessRunner.ProcessRunner, {
    run: Effect.fn("jobs.test.run")(function* (input: ProcessRunner.ProcessRunInput) {
      if (input.command === "/usr/sbin/sysctl") return output(bootId);
      const [operation, domain, file] = input.args;
      if (operation === "bootstrap") {
        if (failBootstrap === "before") {
          failBootstrap = undefined;
          return output("", 1);
        }
        const plist = yield* fs.readFileString(file!).pipe(Effect.orDie);
        const label = /<key>Label<\/key><string>([^<]+)<\/string>/.exec(plist)![1]!;
        units.add(`${domain}/${label}`);
        launches.push(label);
        if (failBootstrap === "after") {
          failBootstrap = undefined;
          const dir = file!.slice(0, -"/job.plist".length);
          yield* fs.makeDirectory(`${dir}/started`).pipe(Effect.orDie);
          return output("", 1);
        }
        return output();
      }
      if (operation === "bootout") {
        stops.push(domain!);
        return output("", units.delete(domain!) ? 0 : 1);
      }
      if (finishingJobId !== undefined) {
        yield* fs
          .writeFileString(
            `${stateDir}/jobs/${finishingJobId}/result.json`,
            encodeResult({
              status: "completed",
              startedAt: 0,
              finishedAt: 1,
              exitCode: 0,
            }),
          )
          .pipe(Effect.orDie);
        finishingJobId = undefined;
        units.delete(domain!);
      }
      inspections++;
      return output(units.has(domain!) ? "state = running" : "", units.has(domain!) ? 0 : 1);
    }),
  });
  const projection: OrchestrationV2ThreadProjection = {
    thread,
    runs: [],
    attempts: [],
    nodes: [],
    subagents: [],
    providerSessions: [],
    providerThreads: [],
    providerTurns: [],
    runtimeRequests: [],
    messages: [],
    plans: [],
    turnItems: [],
    checkpointScopes: [],
    checkpoints: [],
    contextHandoffs: [],
    contextTransfers: [],
    visibleTurnItems: [],
    updatedAt: now,
  };
  const layer = JobManager.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        ServerConfig.layer(config),
        runner,
        Layer.succeed(FileSystem.FileSystem, {
          ...fs,
          open: (path, options) =>
            Effect.gen(function* () {
              if (rotateOnOpen && path.endsWith("/output.log")) {
                rotateOnOpen = false;
                yield* fs.rename(path, `${path}.1`);
              }
              return yield* fs.open(path, options);
            }),
        }),
        Layer.succeed(HostProcess.Platform, platform),
        Layer.succeed(HostProcess.UserId, 501),
        Layer.mock(ProjectionStore.ProjectionStoreV2)({
          getThreadRecords: (id) =>
            Effect.succeed({
              ...projection,
              thread: { ...thread, id, archivedAt: archived ? now : null },
            }),
        }),
        Layer.mock(ProjectStore.ProjectStoreV2)({
          get: () =>
            Effect.succeedSome({
              projectId,
              title: "Jobs",
              workspaceRoot: stateDir,
              defaultModelSelection: null,
              defaultThreadEnvMode: null,
              autoPull: false,
              faviconPath: null,
              projectIcon: null,
              scripts: [],
              pinnedAt: null,
              archivedAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              deletedAt: null,
            }),
        }),
      ),
    ),
  );
  const manager = () => JobManager.JobManager.pipe(Effect.provide(Layer.fresh(layer)));
  return {
    fs,
    stateDir,
    threadId,
    launches,
    stops,
    units,
    manager,
    inspections: () => inspections,
    failNextLaunch: (phase: "before" | "after" = "before") => {
      failBootstrap = phase;
    },
    archive: () => {
      archived = true;
    },
    rotate: () => {
      rotateOnOpen = true;
    },
    finishOnInspect: (id: string) => {
      finishingJobId = id;
    },
    reboot: () => {
      bootId = "boot-b";
    },
    finish: (id: string, status: "completed" | "running" = "completed") =>
      fs.writeFileString(
        `${stateDir}/jobs/${id}/result.json`,
        encodeResult({
          status,
          startedAt: 0,
          finishedAt: status === "running" ? null : 1,
          exitCode: status === "running" ? null : 0,
        }),
      ),
  };
});

it.effect(
  "reattaches after server reconstruction without relaunching and refuses cross-thread Stop",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        const first = yield* f.manager();
        const input = {
          threadId: f.threadId,
          requestId: "build",
          command: "printf progress",
          title: "Build the app",
        };
        const job = yield* first.start(input);
        yield* f.finish(job.id, "running");
        // A crash before publishing intent leaves an inert directory, not a broken environment.
        yield* f.fs.makeDirectory(`${f.stateDir}/jobs/${"b".repeat(64)}`);
        const second = yield* f.manager();
        expect((yield* second.list(f.threadId)).jobs[0]?.status).toBe("running");
        expect((yield* second.list(f.threadId)).jobs[0]?.title).toBe("Build the app");
        expect((yield* second.start(input)).id).toBe(job.id);
        expect(f.launches).toHaveLength(1);
        const denied = yield* second
          .stop({ threadId: ThreadId.make("other-thread"), jobId: job.id })
          .pipe(Effect.flip);
        expect(denied.reason).toBe("not-found");
        expect(f.stops).toHaveLength(0);
        yield* second.stopThread(f.threadId);
        const inspections = f.inspections();
        const stopped = (yield* second.read({ threadId: f.threadId, jobId: job.id })).job;
        expect(stopped.status).toBe("stopped");
        expect(stopped.finishedAt).not.toBeNull();
        yield* second.list(f.threadId);
        expect(f.inspections()).toBe(inspections);
        expect(f.stops).toHaveLength(1);
        yield* second.start({ ...input, requestId: "archive" });
        f.archive();
        const recovered = yield* f.manager();
        expect(
          (yield* recovered.list(f.threadId)).jobs.every((entry) => entry.status === "stopped"),
        ).toBe(true);
        expect(
          (yield* recovered.start({ ...input, requestId: "archived" }).pipe(Effect.flip)).reason,
        ).toBe("unavailable");
      }),
    ).pipe(Effect.provide(NodeServices.layer)),
);

it.effect(
  "keeps launch retries idempotent, bounds output, and blocks removal of an active job's worktree",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        const jobs = yield* f.manager();
        const input = { threadId: f.threadId, requestId: "same", command: "build" };
        yield* f.fs.makeDirectory(`${f.stateDir}/subdir`);
        const relative = yield* jobs.start({ ...input, requestId: "relative", cwd: "subdir" });
        expect(relative.cwd).toBe(yield* f.fs.realPath(`${f.stateDir}/subdir`));
        yield* f.finish(relative.id);
        f.failNextLaunch();
        expect((yield* jobs.start(input).pipe(Effect.flip)).reason).toBe("unsupported");
        const job = yield* jobs.start(input);
        f.failNextLaunch("after");
        const ambiguousInput = { ...input, requestId: "ambiguous" };
        expect((yield* jobs.start(ambiguousInput).pipe(Effect.flip)).reason).toBe("unsupported");
        const launchCount = f.launches.length;
        const ambiguous = yield* jobs.start(ambiguousInput);
        expect(f.launches).toHaveLength(launchCount);
        expect(yield* f.fs.exists(`${f.stateDir}/jobs/${ambiguous.id}/started`)).toBe(true);
        yield* f.finish(ambiguous.id);
        expect(job.status).toBe("starting");
        expect((yield* jobs.start({ ...input, command: "other" }).pipe(Effect.flip)).reason).toBe(
          "conflict",
        );
        expect((yield* jobs.assertWorktreeIdle(f.stateDir).pipe(Effect.flip)).reason).toBe(
          "worktree-busy",
        );
        yield* f.fs.writeFileString(
          `${f.stateDir}/jobs/${job.id}/output.log`,
          "x".repeat(JOB_TAIL_BYTES * 2),
        );
        const read = yield* jobs.read({ threadId: f.threadId, jobId: job.id });
        expect(read.text).toHaveLength(JOB_TAIL_BYTES);
        expect(read.truncated).toBe(true);
        f.rotate();
        expect((yield* jobs.read({ threadId: f.threadId, jobId: job.id })).text).toHaveLength(
          JOB_TAIL_BYTES,
        );
        yield* f.fs.writeFileString(`${f.stateDir}/jobs/${job.id}/output.log`, "new output");
        expect((yield* jobs.read({ threadId: f.threadId, jobId: job.id })).text).toBe(
          "x".repeat(JOB_TAIL_BYTES - 10) + "new output",
        );
        yield* f.fs.writeFileString(
          `${f.stateDir}/jobs/${job.id}/output.log`,
          "€" + "x".repeat(JOB_TAIL_BYTES - 1),
        );
        expect((yield* jobs.read({ threadId: f.threadId, jobId: job.id })).text).toBe(
          "x".repeat(JOB_TAIL_BYTES - 1),
        );
        f.finishOnInspect(job.id);
        expect((yield* jobs.wait({ threadId: f.threadId, jobId: job.id })).job.status).toBe(
          "completed",
        );
        yield* jobs.assertWorktreeIdle(f.stateDir);
        yield* jobs.assertWorktreeIdle(`${f.stateDir}/already-removed`);
        expect((yield* jobs.wait({ threadId: f.threadId, jobId: job.id })).job.status).toBe(
          "completed",
        );
        for (let index = 0; index < 8; index++)
          yield* jobs.start({ ...input, requestId: `capacity-${index}` });
        expect(
          (yield* jobs.start({ ...input, requestId: "overflow" }).pipe(Effect.flip)).reason,
        ).toBe("capacity");
      }),
    ).pipe(Effect.provide(NodeServices.layer)),
);

it.effect(
  "marks jobs lost after reboot without relaunching or signaling an unrelated process",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        const jobs = yield* f.manager();
        yield* jobs.start({ threadId: f.threadId, requestId: "reboot", command: "build" });
        f.reboot();
        const recovered = yield* f.manager();
        expect((yield* recovered.list(f.threadId)).jobs[0]?.status).toBe("lost");
        expect((yield* recovered.list(f.threadId)).jobs[0]?.finishedAt).not.toBeNull();
        expect(f.launches).toHaveLength(1);
        expect(f.stops).toHaveLength(0);
        const existing = (yield* recovered.list(f.threadId)).jobs[0]!;
        yield* recovered.stop({ threadId: f.threadId, jobId: existing.id });
        expect(
          (yield* recovered.read({ threadId: f.threadId, jobId: existing.id })).job.status,
        ).toBe("stopped");
      }),
    ).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("disables managed jobs on Linux without launching any commands", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const f = yield* fixture("linux");
      const jobs = yield* f.manager();
      expect(yield* jobs.list(f.threadId)).toEqual({ supported: false, jobs: [] });
      expect(
        yield* jobs
          .start({ threadId: f.threadId, requestId: "disabled", command: "build" })
          .pipe(Effect.flip),
      ).toEqual(new JobError({ reason: "unsupported" }));
      expect(f.launches).toHaveLength(0);
    }),
  ).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("shares job inspection between simultaneous list subscribers", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const f = yield* fixture();
      const jobs = yield* f.manager();
      const job = yield* jobs.start({
        threadId: f.threadId,
        requestId: "shared",
        command: "build",
      });
      const updates = yield* Queue.unbounded<string>();
      for (const subscriber of ["first", "second"]) {
        yield* jobs.watch(f.threadId).pipe(
          Stream.runForEach(() => Queue.offer(updates, subscriber)),
          Effect.forkScoped,
        );
      }
      yield* Queue.take(updates);
      yield* Queue.take(updates);
      expect(f.inspections()).toBe(1);
      yield* f.finish(job.id, "running");
      yield* TestClock.adjust("2 seconds");
      yield* Queue.take(updates);
      yield* Queue.take(updates);
      expect(f.inspections()).toBe(2);
    }),
  ).pipe(Effect.provide(NodeServices.layer)),
);
