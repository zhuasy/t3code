// @effect-diagnostics nodeBuiltinImport:off globalDate:off -- Isolated launchd CLI worker; it outlives the server runtime.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { JOB_LOG_BYTES } from "./limits.ts";

/** Separate CLI entrypoint: launchd, rather than the server, owns this lifetime. */
export async function runJob(directory: string) {
  // Keep this worker free of the server/Effect module graph: every live job owns one process.
  const intent: unknown = JSON.parse(
    NodeFS.readFileSync(NodePath.join(directory, "intent.json"), "utf8"),
  );
  if (typeof intent !== "object" || intent === null || !("job" in intent))
    throw new Error("Invalid job intent");
  const job = intent.job;
  if (
    typeof job !== "object" ||
    job === null ||
    !("command" in job) ||
    typeof job.command !== "string" ||
    !("cwd" in job) ||
    typeof job.cwd !== "string" ||
    !("threadId" in job) ||
    typeof job.threadId !== "string" ||
    !("id" in job) ||
    typeof job.id !== "string"
  )
    throw new Error("Invalid job intent");
  // An interrupted launch can be retried by the transport, but never execute the payload twice.
  try {
    NodeFS.mkdirSync(NodePath.join(directory, "started"), { mode: 0o700 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return;
    throw error;
  }
  const startedAt = Date.now();
  const resultPath = NodePath.join(directory, "result.json");
  const writeResult = (
    status: "running" | "completed" | "failed" | "stopped",
    exitCode: number | null,
  ) => {
    NodeFS.writeFileSync(
      `${resultPath}.tmp`,
      JSON.stringify({
        status,
        startedAt,
        finishedAt: status === "running" ? null : Date.now(),
        exitCode,
      }),
      { mode: 0o600 },
    );
    NodeFS.renameSync(`${resultPath}.tmp`, resultPath);
  };
  const output = NodePath.join(directory, "output.log");
  let bytes = 0;
  const append = (chunk: Buffer) => {
    for (let offset = 0; offset < chunk.length;) {
      if (bytes === JOB_LOG_BYTES) {
        NodeFS.rmSync(`${output}.1`, { force: true });
        NodeFS.renameSync(output, `${output}.1`);
        bytes = 0;
      }
      const part = chunk.subarray(offset, offset + JOB_LOG_BYTES - bytes);
      NodeFS.appendFileSync(output, part, { mode: 0o600 });
      bytes += part.length;
      offset += part.length;
    }
  };
  writeResult("running", null);
  const { ELECTRON_RUN_AS_NODE: _electron, ...environment } = process.env;
  const child = NodeChildProcess.spawn("/bin/zsh", ["-lc", job.command], {
    cwd: job.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...environment,
      PYTHONUNBUFFERED: "1",
      T3CODE_THREAD_ID: job.threadId,
      T3CODE_JOB_ID: job.id,
    },
  });
  let stopping = false;
  const stop = () => {
    stopping = true;
    child.kill("SIGTERM");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  await new Promise<void>((resolve) => {
    child.once("error", () => {
      append(Buffer.from("Unable to start command.\n"));
    });
    child.once("close", (code) => {
      writeResult(
        stopping || NodeFS.existsSync(NodePath.join(directory, "stop"))
          ? "stopped"
          : code === 0
            ? "completed"
            : "failed",
        code,
      );
      resolve();
    });
  });
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
