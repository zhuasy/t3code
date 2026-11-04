import {
  Job,
  JobError,
  JobList,
  JobOutput,
  JobStartInput,
  JobId,
  JobTitle,
  OrchestratorMcpFailure,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";
import * as JobManager from "../../../jobs/JobManager.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";

const shared = {
  failure: Schema.Union([JobError, OrchestratorMcpFailure]),
  failureMode: "return" as const,
  dependencies: [
    JobManager.JobManager,
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
};
const start = Tool.make("job_start", {
  ...shared,
  description:
    "Run a long shell command as a managed job in this thread's macOS environment (full-access mode only). Survives T3 server restarts, not host reboot/logout. Give it a short, human-readable title describing the work (for example, Train image classifier). Prefer useful progress flags and unbuffered output; stdin is closed. Returns immediately with a job ID visible in Jobs. Reuse requestId when retrying the same launch; never relaunch just because T3 restarted. No tmux/nohup needed. Up to eight running jobs per environment.",
  parameters: Schema.Struct({
    title: JobTitle,
    requestId: JobStartInput.fields.requestId,
    command: JobStartInput.fields.command,
    cwd: JobStartInput.fields.cwd,
  }),
  success: Job,
})
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true);
const list = Tool.make("job_list", {
  ...shared,
  description:
    "List this thread's managed jobs and whether this host supports them. After a restart, check here before starting another copy.",
  parameters: Tool.EmptyParams,
  success: JobList,
}).annotate(Tool.Readonly, true);
const read = Tool.make("job_read", {
  ...shared,
  description:
    "Read a managed job's status and bounded stdout/stderr tail. Only jobs owned by this thread can be read. For completion use job_wait instead of polling.",
  parameters: Schema.Struct({ jobId: JobId }),
  success: JobOutput,
}).annotate(Tool.Readonly, true);
const stop = Tool.make("job_stop", {
  ...shared,
  description:
    "Stop this thread's managed job through launchd, including its process group. Does not affect other threads' jobs. Stop jobs before removing their worktree.",
  parameters: Schema.Struct({ jobId: JobId }),
  success: Job,
})
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true);
const wait = Tool.make("job_wait", {
  ...shared,
  description:
    "Wait for this thread's managed job to exit, then return its status and output tail. Does not launch an agent on completion. If a T3 restart interrupts this wait, call job_list and wait on the existing job ID again.",
  parameters: Schema.Struct({ jobId: JobId }),
  success: JobOutput,
}).annotate(Tool.Readonly, true);
export const JobsToolkit = Toolkit.make(start, list, read, stop, wait);
