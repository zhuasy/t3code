import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, Job, ThreadId } from "@t3tools/contracts";
import { normalizeTerminalOutput } from "@t3tools/shared/terminalOutput";
import { formatDuration } from "@t3tools/shared/orchestrationTiming";
import { ChevronDownIcon, ChevronRightIcon, SquareIcon, TerminalIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { tickTextContent } from "../../lib/tickTextContent";
import { useServerConfigs } from "../../state/entities";
import { jobsEnvironment } from "../../state/jobs";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
import { THREAD_DETAILS_PANEL_ICON_CLASS } from "./threadDetailsPanelStyles";

const statusLabel = (job: Job) => {
  switch (job.status) {
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return job.exitCode === null ? "Failed" : `Failed (${job.exitCode})`;
    case "stopped":
      return "Stopped";
    case "lost":
      return "Interrupted";
  }
};
type Target = { readonly environmentId: EnvironmentId; readonly threadId: ThreadId };

export function ThreadJobsPanel(props: Target) {
  const supported = useServerConfigs().get(props.environmentId)?.environment.capabilities
    .managedJobs;
  return supported ? (
    <ThreadJobsList key={`${props.environmentId}:${props.threadId}`} {...props} />
  ) : null;
}

function ThreadJobsList(props: Target) {
  const { data, error } = useEnvironmentQuery(
    jobsEnvironment.list({
      environmentId: props.environmentId,
      input: { threadId: props.threadId },
    }),
  );
  if (!error && !data?.jobs.length) return null;
  return (
    <ThreadDetailsSection headingId="thread-details-jobs-heading" title="Jobs">
      {error ? (
        <p className="px-2.5 text-2xs text-destructive">Couldn&apos;t load jobs: {error}</p>
      ) : null}
      <ul className="m-0 list-none p-0">
        {data?.jobs.map((job) => (
          <JobRow key={job.id} {...props} job={job} />
        ))}
      </ul>
    </ThreadDetailsSection>
  );
}

function JobRow(props: Target & { readonly job: Job }) {
  const { job } = props;
  const [expanded, setExpanded] = useState(false);
  const [stopping, setStopping] = useState(false);
  const canStop = useAtomValue(jobsEnvironment.stop.permissionAtom(props.environmentId));
  const stop = useAtomCommand(jobsEnvironment.stop, { label: "job stop" });
  const active = job.status === "running" || job.status === "starting";
  const stoppable = active || job.status === "lost";
  return (
    <li>
      <div className="flex items-center">
        <ThreadDetailsControl
          variant="ghost"
          size="sm"
          part="row"
          multiline
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <TerminalIcon aria-hidden className={THREAD_DETAILS_PANEL_ICON_CLASS} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-mono text-2xs">{job.command}</span>
            <span className="text-2xs text-muted-foreground">
              {statusLabel(job)}
              {active ? (
                <span
                  ref={tickTextContent(
                    (now) =>
                      ` · ${formatDuration(Math.max(0, now - (job.startedAt ?? job.createdAt)))}`,
                    true,
                  )}
                />
              ) : null}
            </span>
          </span>
          {expanded ? (
            <ChevronDownIcon aria-hidden className="size-3" />
          ) : (
            <ChevronRightIcon aria-hidden className="size-3" />
          )}
        </ThreadDetailsControl>
        {stoppable ? (
          <ThreadDetailsControl
            variant="ghost"
            size="icon-xs"
            part="icon"
            tone="destructive"
            aria-label={`Stop ${job.command}`}
            disabled={!canStop || stopping}
            onClick={async () => {
              setStopping(true);
              try {
                await stop({
                  environmentId: props.environmentId,
                  input: { threadId: props.threadId, jobId: job.id },
                });
              } finally {
                setStopping(false);
              }
            }}
          >
            <SquareIcon aria-hidden className="size-3 fill-current" />
          </ThreadDetailsControl>
        ) : null}
      </div>
      {expanded ? <JobLog {...props} /> : null}
    </li>
  );
}

function JobLog(props: Target & { readonly job: Job }) {
  const { data, error } = useEnvironmentQuery(
    jobsEnvironment.output({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, jobId: props.job.id },
    }),
  );
  const scrollRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the output DOM while the user is scrolled to the bottom
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && followRef.current) element.scrollTop = element.scrollHeight;
  });
  const job = data?.job ?? props.job;
  const text = normalizeTerminalOutput(data?.text ?? "").text;
  return (
    <div className="mx-2.5 mb-2 space-y-1">
      {error ? (
        <p className="text-2xs text-destructive">Couldn&apos;t load output: {error}</p>
      ) : null}
      {job.status === "running" || job.status === "starting" ? (
        <p
          className="text-2xs text-muted-foreground"
          ref={tickTextContent(
            (now) =>
              job.lastOutputAt === null
                ? "No output yet"
                : `Last output ${formatDuration(Math.max(0, now - job.lastOutputAt))} ago`,
            true,
          )}
        />
      ) : null}
      {data?.truncated ? (
        <p className="text-2xs text-muted-foreground">Showing recent output</p>
      ) : null}
      <pre
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
        }}
        className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-2xs text-muted-foreground"
      >
        {text || (data ? "No output." : "Loading output…")}
      </pre>
    </div>
  );
}
