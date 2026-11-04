---
name: t3-managed-jobs
description: Run, inspect, recover, and stop long shell commands with T3 Code's Jobs tools. Use for long builds, tests, training, data processing, progress output, restart recovery, or orphaned shell jobs on a macOS T3 host. Short shell commands stay in the normal shell.
---

# Managed shell jobs

Use `job_start` by default for commands expected to take more than about a minute,
or which must continue through a disconnect or T3 server restart. This requires a
macOS **host**, a launchd user session, and full-access mode. A Mac client connected
to a Linux host does not qualify. Linux and Windows hosts are unsupported.

Discover the available T3 tools and use their returned schemas; names may have a
provider-specific prefix. If Jobs is unavailable, explain the limitation. Do not
silently substitute tmux, nohup, disown, or a bare background `&`.

## Start and follow work

1. Choose a useful title, such as `Build desktop app` or `Train image classifier`.
   The title is required, single-line, and at most 120 characters. Do not use the
   shell command or the generic `Shell job` fallback as the title.
2. Call `job_start` with `title`, a unique `requestId`, `command`, and an explicit
   `cwd` when the thread's directory is not the intended working directory.
   Relative paths resolve from the thread's worktree or project root, not the T3
   server's launch directory. Full access also permits an explicit outside directory.
   Keep the returned job ID. Reuse the same request ID for retries of that launch;
   a deliberate new run needs a new request ID.
3. Use `job_read {jobId}` to inspect status and the bounded stdout/stderr tail.
   Use `job_wait {jobId}` to await completion; do not poll reads or sleep in a loop.
   If the user only asked to start background work, report its title and ID once
   started instead of waiting for the entire command.
   List subscribers share a one-second snapshot; a momentarily stale list is not
   evidence of a failed operation. Direct operations remain fresh.
4. After a restart or interrupted wait, call `job_list {}` and attach to the existing
   job with `job_wait`. A missing wait result is not permission to launch a duplicate.
5. Use `job_stop {jobId}` when a job is no longer needed. Stop jobs before removing
   their worktree. Archiving or deleting a thread also stops its jobs.

The tools operate on the invoking thread's jobs. Do not bypass ownership checks by
editing job state, killing processes by name, or adopting another thread's job.
Completion alone does not start a paid agent turn.

## Useful output

Jobs use non-interactive pipes: stdin is closed, and output is captured for the Jobs
section. A PTY imitates an interactive terminal and can enable prompts and cursor
controls; Jobs do not provide one. Complete interactive authentication separately.

- Prefer the command's real progress/verbose and non-interactive flags. For Python,
  use `python3 -u`; the runner also sets `PYTHONUNBUFFERED=1`.
- In scripts you write, print concise milestones and measured counts, for example
  `Downloaded 84 / 200 files`. Do not invent percentages or a heartbeat that claims
  progress without evidence. Report errors and preserve a failing exit code.
- ANSI colors are supported and optional. Prefer readable lines over screen-clearing
  terminal interfaces. Some programs still buffer output; silence alone is not failure.
- Avoid secrets in the command and output. Logs are bounded tails, not permanent
  artifact storage; write required results to an appropriate project output file.

## Limits and diagnosis

The web/desktop thread-details section is **Jobs**. New jobs show the agent's title;
`Shell job` means the stored record has no title (for example, an older server).
An updated client cannot add a title that the running server discarded. Verify the
server tool schema before recommending a relaunch; do not restart the user's app
just to test this. Mobile has no dedicated Jobs section yet.

There are at most eight active jobs per environment. Output uses two 4 MiB files,
with a 64 KiB read tail. These bounds do **not** cap the command's RAM or CPU. For
memory pressure, inspect and stop the specific unnecessary job, then reduce the
workload's concurrency or memory use. Persistent does not mean harmless.

Server restarts preserve jobs. Logout and host reboot do not resume them; a lost
job is not automatically relaunched. Stopped/lost results and finish times persist
across reads and restarts. Reuse the same request ID after a reported launch failure;
the manager permits retry only when it can establish that launch never started.
Do not delete runner locks to force a retry after an ambiguous failure.
Stop covers the process group, but a command
that deliberately detaches into a different group can escape it.

For implementation work, start with the [tool schemas](../../../apps/server/src/mcp/toolkits/jobs/tools.ts),
[job manager](../../../apps/server/src/jobs/JobManager.ts), and
[runner](../../../apps/server/src/jobs/runner.ts). Keep reconciliation attach-only,
launches idempotent, logs bounded, and stops scoped to the correct T3 home.
Extend the existing job-manager tests for lifecycle changes. Guidance shared by
all providers lives in [orchestration instructions](../../../packages/provider-core/src/server/orchestrationInstructions.ts);
read [the eval guide](../../../evals/README.md) before changing it.
