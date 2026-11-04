import * as Schema from "effect/Schema";
import { ThreadId } from "./baseSchemas.ts";

export const JobId = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));
export const JobStatus = Schema.Literals([
  "starting",
  "running",
  "completed",
  "failed",
  "stopped",
  "lost",
]);
export const Job = Schema.Struct({
  id: JobId,
  threadId: ThreadId,
  command: Schema.String,
  cwd: Schema.String,
  status: JobStatus,
  createdAt: Schema.Number,
  startedAt: Schema.NullOr(Schema.Number),
  finishedAt: Schema.NullOr(Schema.Number),
  exitCode: Schema.NullOr(Schema.Int),
  lastOutputAt: Schema.NullOr(Schema.Number),
});
export type Job = typeof Job.Type;

export const JobStartInput = Schema.Struct({
  threadId: ThreadId,
  requestId: Schema.String.check(Schema.isMinLength(1)).check(Schema.isMaxLength(128)),
  command: Schema.String.check(Schema.isMinLength(1)).check(Schema.isMaxLength(32_768)),
  cwd: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
});
export type JobStartInput = typeof JobStartInput.Type;
export const JobTarget = Schema.Struct({ threadId: ThreadId, jobId: JobId });
export type JobTarget = typeof JobTarget.Type;
export const JobListInput = Schema.Struct({ threadId: ThreadId });
export const JobList = Schema.Struct({ supported: Schema.Boolean, jobs: Schema.Array(Job) });
export const JobOutput = Schema.Struct({
  job: Job,
  text: Schema.String,
  truncated: Schema.Boolean,
});
export type JobOutput = typeof JobOutput.Type;

export class JobError extends Schema.TaggedError<JobError>()("JobError", {
  reason: Schema.Literals([
    "unsupported",
    "not-found",
    "unavailable",
    "capacity",
    "conflict",
    "worktree-busy",
    "io",
  ]),
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message() {
    switch (this.reason) {
      case "unsupported":
        return "Managed jobs require a macOS host with a launchd user session.";
      case "not-found":
        return "This job does not belong to this thread or no longer exists.";
      case "unavailable":
        return "This thread is archived or deleted and cannot start jobs.";
      case "capacity":
        return "Stop a running job before starting another (maximum eight per environment).";
      case "conflict":
        return "This request ID already belongs to a different command.";
      case "worktree-busy":
        return "Stop managed jobs in this worktree before removing it.";
      case "io":
        return "The managed job operation failed.";
    }
  }
}
