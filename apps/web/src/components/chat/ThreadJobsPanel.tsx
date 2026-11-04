import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, Job, ThreadId } from "@t3tools/contracts";
import {
  normalizeTerminalOutput,
  terminalOutputSpans,
  TERMINAL_PALETTES,
} from "@t3tools/shared/terminalOutput";
import { formatDuration } from "@t3tools/shared/orchestrationTiming";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  SquareIcon,
  TerminalIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
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
  const title = job.title ?? "Shell job";
  const StatusIcon =
    job.status === "completed"
      ? CheckCircle2Icon
      : job.status === "failed" || job.status === "lost"
        ? CircleAlertIcon
        : active
          ? Clock3Icon
          : TerminalIcon;
  const statusColor =
    job.status === "completed"
      ? "text-success"
      : job.status === "failed" || job.status === "lost"
        ? "text-destructive"
        : active
          ? "text-primary"
          : "text-muted-foreground";
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
          <StatusIcon aria-hidden className={`${THREAD_DETAILS_PANEL_ICON_CLASS} ${statusColor}`} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="line-clamp-2 whitespace-normal text-xs font-medium text-foreground">
              {title}
            </span>
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
              ) : job.startedAt !== null && job.finishedAt !== null ? (
                ` · ${formatDuration(Math.max(0, job.finishedAt - job.startedAt))}`
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
            aria-label={`Stop ${title}`}
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
  const { resolvedTheme } = useTheme();
  const scrollRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the output DOM while the user is scrolled to the bottom
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && followRef.current) element.scrollTop = element.scrollHeight;
  });
  const job = data?.job ?? props.job;
  const text = normalizeTerminalOutput(data?.text ?? "").text;
  const spans = terminalOutputSpans(text, TERMINAL_PALETTES[resolvedTheme]);
  const active = job.status === "running" || job.status === "starting";
  return (
    <div className="mx-2.5 mb-3 overflow-hidden rounded-lg border border-border/60 bg-background/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
        <span className="text-2xs font-medium text-foreground/80">Output</span>
        {active ? (
          <span
            className="text-2xs text-muted-foreground"
            ref={tickTextContent(
              (now) =>
                job.lastOutputAt === null
                  ? "Waiting for output"
                  : `Updated ${formatDuration(Math.max(0, now - job.lastOutputAt))} ago`,
              true,
            )}
          />
        ) : (
          <span className="text-2xs text-muted-foreground">
            {job.exitCode !== null ? `Exit ${job.exitCode}` : statusLabel(job)}
          </span>
        )}
      </div>
      {error ? (
        <p className="px-3 py-2 text-2xs text-destructive">Couldn&apos;t load output: {error}</p>
      ) : null}
      <pre
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={`Output for ${job.title ?? "shell job"}`}
        onScroll={(event) => {
          const element = event.currentTarget;
          followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
        }}
        className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-2xs leading-relaxed text-foreground/90 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {text ? (
          spans.map((span, index) =>
            span.style === null ? (
              span.text
            ) : (
              // Output spans are replaced together when the tail changes.
              // oxlint-disable-next-line react/no-array-index-key
              <span key={index} style={span.style}>
                {span.text}
              </span>
            ),
          )
        ) : (
          <span className="text-muted-foreground">
            {data ? (active ? "Waiting for output…" : "No output.") : "Loading output…"}
          </span>
        )}
      </pre>
      {data?.truncated ? (
        <p className="px-3 pb-2 text-2xs text-muted-foreground">Showing recent output</p>
      ) : null}
      <details className="border-t border-border/50 text-2xs text-muted-foreground">
        <summary className="cursor-pointer px-3 py-2 select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring">
          Command
        </summary>
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 font-mono text-2xs leading-relaxed">
          {job.command}
        </pre>
      </details>
    </div>
  );
}
