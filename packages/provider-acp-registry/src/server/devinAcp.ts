import type { AcpRegistryProbeModel } from "@t3tools/contracts";
import type * as AcpSchema from "effect-acp/compat";
import type { AcpToolCallState } from "@t3tools/provider-acp/server/runtimeModel";
import type { AcpAdapterV2SubagentUpdate } from "@t3tools/provider-acp/server/adapter";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normalizeDevinSessionUpdate(
  notification: AcpSchema.SessionNotification,
): AcpSchema.SessionNotification {
  const update = notification.update;
  const meta = record("_meta" in update ? update._meta : undefined);
  const parentAgentId = record(meta?.["cognition.ai/subagent_context"])?.parentAgentId;
  const routed =
    typeof parentAgentId === "string" && parentAgentId !== "root"
      ? { ...notification, sessionId: parentAgentId }
      : notification;
  const messageId = meta?.["cognition.ai/streamingMessageId"];
  if (
    (update.sessionUpdate === "agent_message_chunk" ||
      update.sessionUpdate === "agent_thought_chunk") &&
    typeof messageId === "string"
  ) {
    return { ...routed, update: { ...update, messageId } };
  }
  return routed;
}

export function normalizeDevinToolCall(tool: AcpToolCallState): AcpToolCallState {
  const name = record(tool.data.meta)?.["cognition.ai/inferenceToolName"];
  return typeof name === "string" && (!tool.title || tool.title === "Tool")
    ? { ...tool, title: name }
    : tool;
}

export function extractDevinSubagentUpdate(
  tool: AcpToolCallState,
): AcpAdapterV2SubagentUpdate | undefined {
  const meta = record(tool.data.meta);
  const completed = record(meta?.["cognition.ai/subagent_completed"]);
  const started = record(meta?.["cognition.ai/subagent_started"]);
  const data = completed ?? started;
  if (typeof data?.agentId !== "string") return undefined;
  return {
    nativeTaskId: data.agentId,
    childSessionId: data.agentId,
    prompt: typeof started?.task === "string" ? started.task : "",
    title: typeof started?.title === "string" ? started.title : null,
    model: typeof started?.model === "string" ? started.model : null,
    status: completed ? (completed.success === false ? "failed" : "completed") : "running",
    result: typeof completed?.summary === "string" ? completed.summary : null,
  };
}

const DEVIN_CLOUD_CAPABILITIES = ["devin-auto", "devin-ultra", "devin-2-5", "devin_lite"] as const;

export function devinCloudModels(models: ReadonlyArray<AcpRegistryProbeModel>) {
  return DEVIN_CLOUD_CAPABILITIES.flatMap((id) => {
    const model = models.find((candidate) => candidate.id === id);
    return model === undefined ? [] : [model];
  });
}

export function normalizeDevinConfigOptions(
  options: ReadonlyArray<AcpSchema.SessionConfigOption>,
): ReadonlyArray<AcpSchema.SessionConfigOption> {
  return options.map((option) =>
    option.id === "devin_version" && option.type === "select"
      ? { ...option, category: "model" }
      : option,
  );
}

export function isDevinAcp(settings: {
  readonly source: string;
  readonly agentId: string;
  readonly commandPath?: string;
}) {
  return settings.source === "local"
    ? settings.agentId === "devin" ||
        /^devin(?:\.exe|\.cmd)?$/i.test(settings.commandPath?.split(/[\\/]/).pop() ?? "")
    : settings.agentId === "devin";
}

export function devinRuntimeOptions(settings: Parameters<typeof isDevinAcp>[0]) {
  // A replacement prompt must wait until Devin confirms cancellation of its current prompt.
  return isDevinAcp(settings)
    ? {
        normalizeConfigOptions: normalizeDevinConfigOptions,
        cancelBehavior: "wait-for-prompt" as const,
      }
    : {};
}
