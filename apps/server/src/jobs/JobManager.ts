import { JOB_TAIL_BYTES } from "./limits.ts";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Synchronous hashes give launchd jobs deterministic identities across restarts.
import * as NodeCrypto from "node:crypto";
import {
  JobError,
  Job,
  JobId,
  JobList,
  JobOutput as JobOutputSchema,
  type JobStartInput,
  type JobTarget,
  type JobOutput,
  type ThreadId,
} from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";
import * as ServerConfig from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import { JobIntent, JobResult, isJobActive, jobPlist } from "./protocol.ts";

const encodeIntent = Schema.encodeEffect(Schema.fromJsonString(JobIntent));
const decodeIntent = Schema.decodeUnknownEffect(Schema.fromJsonString(JobIntent));
const decodeResult = Schema.decodeUnknownEffect(Schema.fromJsonString(JobResult));
const encodeResult = Schema.encodeEffect(Schema.fromJsonString(JobResult));
const encodeList = Schema.encodeSync(Schema.fromJsonString(JobList));
const encodeOutput = Schema.encodeSync(Schema.fromJsonString(JobOutputSchema));

export class JobManager extends Context.Reference<{
  readonly start: (input: JobStartInput) => Effect.Effect<Job, JobError>;
  readonly list: (
    threadId: ThreadId,
  ) => Effect.Effect<{ supported: boolean; jobs: readonly Job[] }, JobError>;
  readonly read: (input: JobTarget) => Effect.Effect<JobOutput, JobError>;
  readonly stop: (input: JobTarget) => Effect.Effect<Job, JobError>;
  readonly stopThread: (threadId: ThreadId) => Effect.Effect<void, JobError>;
  readonly assertWorktreeIdle: (worktreePath: string) => Effect.Effect<void, JobError>;
  readonly watch: (
    threadId: ThreadId,
  ) => Stream.Stream<{ supported: boolean; jobs: readonly Job[] }, JobError>;
  readonly wait: (input: JobTarget) => Effect.Effect<JobOutput, JobError>;
  readonly watchOutput: (input: JobTarget) => Stream.Stream<JobOutput, JobError>;
}>("t3/jobs/JobManager", {
  defaultValue: () => ({
    start: () => Effect.fail(new JobError({ reason: "unsupported" })),
    list: () => Effect.succeed({ supported: false, jobs: [] }),
    read: () => Effect.fail(new JobError({ reason: "unsupported" })),
    stop: () => Effect.fail(new JobError({ reason: "unsupported" })),
    stopThread: () => Effect.void,
    assertWorktreeIdle: () => Effect.void,
    watch: () => Stream.succeed({ supported: false, jobs: [] }),
    wait: () => Effect.fail(new JobError({ reason: "unsupported" })),
    watchOutput: () => Stream.fail(new JobError({ reason: "unsupported" })),
  }),
}) {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const runner = yield* ProcessRunner.ProcessRunner;
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const projects = yield* ProjectStore.ProjectStoreV2;
  const platform = yield* HostProcess.Platform;
  const uid = yield* HostProcess.UserId;
  const execPath = yield* HostProcess.ExecutablePath;
  const argv = yield* HostProcess.Arguments;
  const executable = yield* HostProcess.IsExecutable;
  const environment = yield* HostProcess.Environment;
  const lock = yield* Semaphore.make(1);
  const root = path.join(config.stateDir, "jobs");
  const homeHash = NodeCrypto.createHash("sha256").update(root).digest("hex").slice(0, 16);
  const domain = `gui/${uid}`;
  const supported = platform === "darwin" && uid !== undefined;
  const io = (cause: unknown) => new JobError({ reason: "io", cause });
  const exists = (file: string) => fs.exists(file).pipe(Effect.mapError(io));
  const directory = (id: string) => path.join(root, id);
  const label = (id: string) => `com.t3tools.t3code.job.${homeHash}.${id}`;
  const target = (id: string) => `${domain}/${label(id)}`;
  const run = Effect.fn("JobManager.launchctl")(function* (args: readonly string[]) {
    return yield* runner
      .run({
        command: "/bin/launchctl",
        args,
        maxOutputBytes: 16 * 1024,
        outputMode: "truncate",
        timeout: "10 seconds",
      })
      .pipe(Effect.mapError(io));
  });
  const boot = yield* Effect.cached(
    runner
      .run({
        command: "/usr/sbin/sysctl",
        args: ["-n", "kern.boottime"],
        maxOutputBytes: 1024,
        timeout: "5 seconds",
      })
      .pipe(
        Effect.filterOrFail((result) => result.code === 0, io),
        Effect.map((result) => result.stdout.trim()),
        Effect.mapError(io),
      ),
  );
  const readIntent = Effect.fn("JobManager.readIntent")(function* (id: string) {
    return yield* fs
      .readFileString(path.join(directory(id), "intent.json"))
      .pipe(Effect.flatMap(decodeIntent), Effect.mapError(io));
  });
  const readResult = Effect.fn("JobManager.readResult")(function* (resultPath: string) {
    return (yield* exists(resultPath))
      ? yield* fs.readFileString(resultPath).pipe(Effect.flatMap(decodeResult), Effect.mapError(io))
      : null;
  });
  const terminal = Effect.fn("JobManager.terminal")(function* (
    job: Job,
    status: "stopped" | "lost",
  ) {
    const resultPath = path.join(directory(job.id), "result.json");
    const result = {
      status,
      startedAt: job.startedAt,
      finishedAt: yield* Clock.currentTimeMillis,
      exitCode: job.exitCode,
    };
    const encoded = yield* encodeResult(result).pipe(Effect.mapError(io));
    // The runner owns result.json.tmp until launchd has finished stopping it.
    yield* fs
      .writeFileString(`${resultPath}.manager.tmp`, encoded, { mode: 0o600 })
      .pipe(Effect.mapError(io));
    yield* fs.rename(`${resultPath}.manager.tmp`, resultPath).pipe(Effect.mapError(io));
    return { ...job, ...result };
  });
  const resultOf = Effect.fn("JobManager.resultOf")(function* (job: Job, bootId: string) {
    const dir = directory(job.id);
    const resultPath = path.join(dir, "result.json");
    const result = yield* readResult(resultPath);
    let current: Job = result ? { ...job, ...result } : job;
    if (isJobActive(current)) {
      if (bootId !== (yield* boot))
        current = yield* terminal(
          current,
          (yield* exists(path.join(dir, "stop"))) ? "stopped" : "lost",
        );
      else {
        const state = yield* run(["print", target(job.id)]);
        if (state.code !== 0 || /state = (?:exited|not running)/.test(state.stdout)) {
          // The runner can publish its exit between our first read and launchctl's reply.
          const finalResult = yield* readResult(resultPath);
          if (finalResult !== null && !isJobActive(finalResult))
            current = { ...job, ...finalResult };
          else {
            const stopped = yield* exists(path.join(dir, "stop"));
            current = yield* terminal(current, stopped ? "stopped" : "lost");
          }
        }
      }
    }
    const log = path.join(dir, "output.log");
    const lastOutputAt = yield* fs.stat(log).pipe(
      Effect.map((stat) => Option.getOrNull(Option.map(stat.mtime, (time) => time.getTime()))),
      Effect.orElseSucceed(() => null),
    );
    return { ...current, lastOutputAt };
  });
  const all = Effect.fn("JobManager.all")(function* () {
    if (!supported || !(yield* exists(root))) return [];
    const ids = (yield* fs.readDirectory(root).pipe(Effect.mapError(io))).filter(Schema.is(JobId));
    const intents = yield* Effect.filter(ids, (id) =>
      exists(path.join(directory(id), "intent.json")),
    );
    return yield* Effect.forEach(
      intents,
      (id) => readIntent(id).pipe(Effect.flatMap(({ job, bootId }) => resultOf(job, bootId))),
      { concurrency: 4 },
    );
  });
  const owned = Effect.fn("JobManager.owned")(function* (input: JobTarget) {
    if (!supported) return yield* new JobError({ reason: "unsupported" });
    if (!(yield* exists(path.join(directory(input.jobId), "intent.json"))))
      return yield* new JobError({ reason: "not-found" });
    const intent = yield* readIntent(input.jobId);
    if (intent.job.threadId !== input.threadId) return yield* new JobError({ reason: "not-found" });
    return yield* resultOf(intent.job, intent.bootId);
  });
  const stop = Effect.fn("JobManager.stopOwned")(function* (input: JobTarget) {
    const job = yield* owned(input);
    if (!isJobActive(job) && job.status !== "lost") return job;
    yield* fs.writeFileString(path.join(directory(job.id), "stop"), "").pipe(Effect.mapError(io));
    const stopped = yield* run(["bootout", target(job.id)]);
    if (stopped.code !== 0) {
      const state = yield* run(["print", target(job.id)]);
      if (state.code === 0) return yield* new JobError({ reason: "io" });
    }
    const result = yield* readResult(path.join(directory(job.id), "result.json"));
    if (result !== null && !isJobActive(result) && result.status !== "lost")
      return { ...job, ...result };
    return yield* terminal(job, "stopped");
  });
  const forThread = (allJobs: readonly Job[], threadId: ThreadId) => {
    const jobs = allJobs
      .filter((job) => job.threadId === threadId)
      .toSorted((a, b) => b.createdAt - a.createdAt);
    return {
      supported,
      jobs: [...jobs.filter(isJobActive), ...jobs.filter((job) => !isJobActive(job)).slice(0, 8)],
    };
  };
  const list = Effect.fn("JobManager.list")(function* (threadId: ThreadId) {
    return forThread(yield* all(), threadId);
  }, lock.withPermits(1));
  const start = Effect.fn("JobManager.start")(
    function* (input: JobStartInput) {
      if (!supported) return yield* new JobError({ reason: "unsupported" });
      const { thread } = yield* projections
        .getThreadRecords(input.threadId, [])
        .pipe(Effect.mapError(io));
      if (thread.deletedAt !== null || thread.archivedAt !== null)
        return yield* new JobError({ reason: "unavailable" });
      const project = yield* projects.get(thread.projectId).pipe(Effect.mapError(io));
      if (Option.isNone(project)) return yield* new JobError({ reason: "unavailable" });
      const workspaceRoot = thread.worktreePath ?? project.value.workspaceRoot;
      const cwd = yield* fs
        .realPath(path.resolve(workspaceRoot, input.cwd ?? "."))
        .pipe(Effect.mapError(io));
      const id = NodeCrypto.createHash("sha256")
        .update(`${input.threadId}\0${input.requestId}`)
        .digest("hex");
      const dir = directory(id);
      if (yield* exists(path.join(dir, "intent.json"))) {
        const previous = yield* owned({ threadId: input.threadId, jobId: id });
        if (previous.command !== input.command || previous.cwd !== cwd)
          return yield* new JobError({ reason: "conflict" });
        return previous;
      }
      const existing = yield* all();
      if (existing.filter(isJobActive).length >= 8)
        return yield* new JobError({ reason: "capacity" });
      // Only finished history is pruned; a noisy running job must never evict another running job.
      for (const old of existing
        .filter((job) => !isJobActive(job))
        .toSorted((a, b) => b.createdAt - a.createdAt)
        .slice(63)) {
        yield* run(["bootout", target(old.id)]);
        yield* fs.remove(directory(old.id), { recursive: true }).pipe(Effect.mapError(io));
      }
      yield* fs.makeDirectory(dir, { recursive: true, mode: 0o700 }).pipe(Effect.mapError(io));
      const job: Job = {
        id,
        threadId: input.threadId,
        title: input.title ?? "Shell job",
        command: input.command,
        cwd,
        status: "starting",
        createdAt: yield* Clock.currentTimeMillis,
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        lastOutputAt: null,
      };
      const bootId = yield* boot;
      const encoded = yield* encodeIntent({
        job,
        bootId,
      }).pipe(Effect.mapError(io));
      yield* fs
        .writeFileString(path.join(dir, "intent.json.tmp"), encoded, { mode: 0o600 })
        .pipe(Effect.mapError(io));
      yield* fs
        .rename(path.join(dir, "intent.json.tmp"), path.join(dir, "intent.json"))
        .pipe(Effect.mapError(io));
      const plist = path.join(dir, "job.plist");
      const env = Object.fromEntries(
        ["PATH", "HOME", "TMPDIR", "LANG"].flatMap((key) =>
          environment[key] ? [[key, environment[key]!]] : [],
        ),
      );
      yield* fs
        .writeFileString(
          plist,
          jobPlist({
            label: label(id),
            directory: dir,
            program: [execPath, ...(executable ? [] : [argv[1]!]), "__job-runner", dir],
            environment: { ...env, ELECTRON_RUN_AS_NODE: "1" },
          }),
          { mode: 0o600 },
        )
        .pipe(Effect.mapError(io));
      const launched = yield* run(["bootstrap", domain, plist]);
      if (launched.code !== 0) {
        // An ambiguous launch must retain its once-only runner lock.
        const state = yield* run(["print", target(id)]);
        if (state.code !== 0 && !(yield* exists(path.join(dir, "started"))))
          yield* fs.remove(dir, { recursive: true }).pipe(Effect.mapError(io));
        return yield* new JobError({ reason: "unsupported" });
      }
      return job;
    },
    Effect.uninterruptible,
    lock.withPermits(1),
  );
  const readLog = Effect.fn("JobManager.readLog")(function* (filePath: string, limit: number) {
    const file = yield* fs.open(filePath, { flag: "r" }).pipe(
      Effect.catchIf(
        (error) => error.reason._tag === "NotFound",
        () => Effect.succeed(null),
      ),
    );
    if (file === null) return null;
    const info = yield* file.stat;
    const length = Math.min(Number(info.size), limit);
    yield* file.seek(info.size - BigInt(length), "start");
    const buffer = new Uint8Array(length);
    let bytes = 0;
    while (bytes < length) {
      const count = Number(yield* file.read(buffer.subarray(bytes)));
      if (count === 0) break;
      bytes += count;
    }
    return {
      buffer: buffer.subarray(0, bytes),
      size: Number(info.size),
      ino: Option.getOrNull(info.ino),
    };
  });
  const read = Effect.fn("JobManager.read")(function* (input: JobTarget) {
    const job = yield* owned(input);
    const log = path.join(directory(job.id), "output.log");
    const text = yield* Effect.scoped(
      Effect.gen(function* () {
        const current = yield* readLog(log, JOB_TAIL_BYTES);
        const previous = yield* readLog(`${log}.1`, JOB_TAIL_BYTES - (current?.buffer.length ?? 0));
        // Rotation between opens can make both handles refer to the same file.
        const prefix = current?.ino !== null && current?.ino === previous?.ino ? null : previous;
        const buffer = new Uint8Array((prefix?.buffer.length ?? 0) + (current?.buffer.length ?? 0));
        buffer.set(prefix?.buffer ?? [], 0);
        buffer.set(current?.buffer ?? [], prefix?.buffer.length ?? 0);
        const truncated = previous !== null || (current?.size ?? 0) > buffer.length;
        let start = 0;
        if (truncated) {
          while (start < buffer.length && (buffer[start]! & 0xc0) === 0x80) start++;
        }
        return {
          text: new TextDecoder().decode(buffer.subarray(start), { stream: true }),
          truncated,
        };
      }),
    ).pipe(Effect.mapError(io));
    return { job, ...text };
  }, lock.withPermits(1));
  const stopThread = Effect.fn("JobManager.stopThread")(function* (threadId: ThreadId) {
    for (const job of (yield* all()).filter((job) => job.threadId === threadId && isJobActive(job)))
      yield* stop({ threadId, jobId: job.id });
  }, lock.withPermits(1));
  const assertWorktreeIdle = Effect.fn("JobManager.assertWorktreeIdle")(function* (
    worktreePath: string,
  ) {
    if (!supported) return;
    const base = yield* fs.realPath(worktreePath).pipe(
      Effect.catchIf(
        (error) => error.reason._tag === "NotFound",
        () => Effect.succeed(null),
      ),
      Effect.mapError(io),
    );
    if (base === null) return;
    if (
      (yield* all()).some(
        (job) => isJobActive(job) && (job.cwd === base || job.cwd.startsWith(`${base}${path.sep}`)),
      )
    )
      return yield* new JobError({ reason: "worktree-busy" });
  }, lock.withPermits(1));
  const watchedJobs = yield* Effect.cachedWithTTL(lock.withPermit(all()), "1 second");
  const watch = (threadId: ThreadId) =>
    Stream.fromEffectSchedule(watchedJobs, Schedule.spaced("2 seconds")).pipe(
      Stream.map((jobs) => forThread(jobs, threadId)),
      Stream.changesWith((a, b) => encodeList(a) === encodeList(b)),
    );
  const watchOutput = (input: JobTarget) =>
    Stream.fromEffectSchedule(read(input), Schedule.spaced("500 millis")).pipe(
      Stream.changesWith((a, b) => encodeOutput(a) === encodeOutput(b)),
    );
  const wait = Effect.fn("JobManager.wait")(function* (input: JobTarget) {
    const result = yield* watchOutput(input).pipe(
      Stream.filter((output) => !isJobActive(output.job)),
      Stream.take(1),
      Stream.runHead,
    );
    return Option.isSome(result) ? result.value : yield* new JobError({ reason: "not-found" });
  });
  if (supported) {
    for (const job of (yield* all()).filter(isJobActive)) {
      const records = yield* projections
        .getThreadRecords(job.threadId, [])
        .pipe(
          Effect.asSome,
          Effect.catchTags({ ProjectionStoreThreadNotFoundError: () => Effect.succeedNone }),
          Effect.mapError(io),
        );
      if (
        Option.isNone(records) ||
        records.value.thread.archivedAt !== null ||
        records.value.thread.deletedAt !== null
      )
        yield* stop({ threadId: job.threadId, jobId: job.id });
    }
  }
  return JobManager.of({
    start,
    list,
    read,
    stop: Effect.fn("JobManager.stop")(stop, Effect.uninterruptible, lock.withPermits(1)),
    stopThread,
    assertWorktreeIdle,
    watch,
    watchOutput,
    wait,
  });
});

export const layer = Layer.effect(JobManager, make);
