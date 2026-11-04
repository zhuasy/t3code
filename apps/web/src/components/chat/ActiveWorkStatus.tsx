import type { ReactNode } from "react";
import { AiStatus, type AiStatusState } from "../ui/ai-status";
import type { WorkEntryIconName } from "./TimelineToolActivityIcon";

const ACTIVITIES: Partial<Record<WorkEntryIconName, { state: AiStatusState; label: string }>> = {
  brain: { state: "thinking", label: "Thinking" },
  eye: { state: "reading", label: "Reading" },
  search: { state: "searching", label: "Searching" },
  globe: { state: "searching", label: "Searching" },
  browser: { state: "working", label: "Using browser" },
  computer: { state: "working", label: "Using computer" },
  device: { state: "working", label: "Using device" },
  "square-pen": { state: "writing", label: "Writing" },
  code: { state: "running", label: "Running" },
  terminal: { state: "running", label: "Running" },
  "list-todo": { state: "planning", label: "Planning" },
  "pull-request": { state: "analyzing", label: "Reviewing" },
};

const VERBS: Record<string, string> = {
  List: "Listing",
  Find: "Finding",
  Grep: "Searching",
  Glob: "Finding",
  Inspect: "Inspecting",
  Update: "Updating",
  Create: "Creating",
  Delete: "Deleting",
  Read: "Reading",
  Run: "Running",
  Edit: "Editing",
  Write: "Writing",
  Search: "Searching",
  Fetch: "Fetching",
  Review: "Reviewing",
  Check: "Checking",
};

export function ActiveWorkStatus({
  label,
  iconName,
}: {
  label: ReactNode;
  iconName: WorkEntryIconName | undefined;
}) {
  const activity = (iconName && ACTIVITIES[iconName]) || { state: "working", label: "Working" };
  const thinking = activity.state === "thinking";
  const formatted =
    typeof label === "string"
      ? label.replace(
          /^(Read|Run|Edit|Write|Search|Fetch|Review|Check|List|Find|Grep|Glob|Inspect|Update|Create|Delete)\b/,
          (verb) => VERBS[verb] ?? verb,
        )
      : label;
  const parts =
    typeof formatted === "string"
      ? /^(Reading|Running|Editing|Writing|Searching|Fetching|Reviewing|Checking|Testing|Waiting|Listing|Finding|Inspecting|Updating|Creating|Deleting)\b\s*(.*)$/.exec(
          formatted,
        )
      : null;
  const primary = thinking ? "Thinking" : (parts?.[1] ?? activity.label);
  const detail = thinking
    ? label === "Thinking"
      ? null
      : label
    : parts
      ? parts[2]
      : typeof label === "string"
        ? formatted
        : null;
  return (
    <div
      className="flex min-h-6 min-w-0 max-w-full items-center gap-2"
      data-work-activity={activity.state}
    >
      <div className="shrink-0 max-w-full min-w-0">
        <AiStatus
          compact
          state={activity.state}
          label={typeof label !== "string" && !thinking ? label : primary}
          timer={false}
          shimmer={false}
          thinkingPhrases={thinking}
          aria-live="off"
        />
      </div>
      {detail && detail !== primary ? (
        <span className="min-w-0 truncate text-sm text-muted-foreground">{detail}</span>
      ) : null}
    </div>
  );
}
