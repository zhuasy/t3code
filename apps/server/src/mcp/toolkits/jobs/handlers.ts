import * as Effect from "effect/Effect";
import * as JobManager from "../../../jobs/JobManager.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { assertFullAccess, readCaller } from "../../threadAccess.ts";
import { JobsToolkit } from "./tools.ts";

const caller = Effect.gen(function* () {
  const scope = yield* McpInvocationContext.McpInvocationContext;
  const { thread } = yield* McpInvocationContext.requireThreadScope(scope, "Managed jobs");
  return { threadId: thread.threadId, jobs: yield* JobManager.JobManager };
});
export const layer = McpToolAccess.toLayer(JobsToolkit, {
  job_start: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      yield* assertFullAccess(
        yield* readCaller(),
        "Starting a shell job requires full-access mode.",
      );
      const { threadId, jobs } = yield* caller;
      return yield* jobs.start({ ...input, threadId });
    }),
  ),
  job_list: McpToolAccess.readsAsCaller(() =>
    Effect.gen(function* () {
      const { threadId, jobs } = yield* caller;
      return yield* jobs.list(threadId);
    }),
  ),
  job_read: McpToolAccess.readsAsCaller((input) =>
    Effect.gen(function* () {
      const { threadId, jobs } = yield* caller;
      return yield* jobs.read({ ...input, threadId });
    }),
  ),
  job_stop: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { threadId, jobs } = yield* caller;
      return yield* jobs.stop({ ...input, threadId });
    }),
  ),
  job_wait: McpToolAccess.readsAsCaller((input) =>
    Effect.gen(function* () {
      const { threadId, jobs } = yield* caller;
      return yield* jobs.wait({ ...input, threadId });
    }),
  ),
});
