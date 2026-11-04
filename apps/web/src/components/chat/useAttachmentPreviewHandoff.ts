import {
  type OrchestrationV2ConversationMessage,
  type EnvironmentId,
  type MessageId,
  type ThreadId,
} from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import { selectHandoffImageResources } from "../../session-logic";
import type { useQuietThreadVisibleTurnItems } from "../../state/entities";
import { useAssetUrls } from "../../assets/assetUrls";
import {
  dropOptimisticHandoff,
  loadedHandoffMessageIdsAtom,
  type OptimisticBlobPreviews,
  type OptimisticUserMessages,
} from "./optimisticUserMessages";

interface AttachmentPreviewHandoffInput {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly serverMessages?: ReadonlyArray<OrchestrationV2ConversationMessage> | undefined;
  readonly serverVisibleTurnItems: ReturnType<typeof useQuietThreadVisibleTurnItems>;
  /** Blob previews of acknowledged messages, by message id; they stand in for the server's copy. */
  readonly handoff: OptimisticUserMessages["handoff"];
  readonly blobPreviews: OptimisticBlobPreviews;
  readonly setOptimisticUserMessages: Dispatch<SetStateAction<OptimisticUserMessages>>;
}

interface HandoffMessage {
  readonly id: MessageId;
  readonly role: "user";
  readonly attachments: OrchestrationV2ConversationMessage["attachments"];
}

const NO_HANDOFF_MESSAGES: ReadonlyArray<HandoffMessage> = [];

function handoffMessages(
  handoff: OptimisticUserMessages["handoff"],
  serverMessages: ReadonlyArray<OrchestrationV2ConversationMessage> | undefined,
  serverVisibleTurnItems: AttachmentPreviewHandoffInput["serverVisibleTurnItems"],
): ReadonlyArray<HandoffMessage> {
  if (Object.keys(handoff).length === 0) return NO_HANDOFF_MESSAGES;
  const byId = new Map<MessageId, HandoffMessage>();
  for (const message of serverMessages ?? []) {
    if (message.role !== "user") continue;
    byId.set(message.id, { id: message.id, role: "user", attachments: message.attachments });
  }
  for (const { item } of serverVisibleTurnItems) {
    if (item.type !== "user_message") continue;
    byId.set(item.messageId, { id: item.messageId, role: "user", attachments: item.attachments });
  }
  return [...byId.values()];
}

/** Each handoff whose server previews are all minted, as [messageId, serverUrls, blobUrls]. */
function pendingHandoffPreloads(
  messages: ReadonlyArray<HandoffMessage>,
  handoff: OptimisticUserMessages["handoff"],
  serverAttachmentUrlById: ReadonlyMap<string, string>,
): Array<readonly [MessageId, ReadonlyArray<string>, ReadonlyArray<string>]> {
  const pendingPreloads: Array<readonly [MessageId, ReadonlyArray<string>, ReadonlyArray<string>]> =
    [];
  for (const message of messages) {
    const handoffUrls = handoff[message.id];
    if (handoffUrls === undefined || message.attachments.length === 0) continue;
    const serverPreviewUrls = message.attachments.flatMap((attachment) => {
      if (attachment.type !== "image") return [];
      const url = serverAttachmentUrlById.get(attachment.id);
      return url === undefined ? [] : [url];
    });
    if (
      serverPreviewUrls.length === 0 ||
      serverPreviewUrls.length !== handoffUrls.length ||
      serverPreviewUrls.some((previewUrl) => previewUrl.startsWith("blob:"))
    ) {
      continue;
    }
    pendingPreloads.push([message.id, serverPreviewUrls, handoffUrls]);
  }
  return pendingPreloads;
}

function withHandoffUrls(
  serverAttachmentUrlById: ReadonlyMap<string, string>,
  messages: ReadonlyArray<HandoffMessage>,
  handoff: OptimisticUserMessages["handoff"],
): Map<string, string> {
  const urls = new Map(serverAttachmentUrlById);
  for (const message of messages) {
    const handoffUrls = handoff[message.id];
    if (handoffUrls === undefined) continue;
    let imageIndex = 0;
    for (const attachment of message.attachments) {
      if (attachment.type !== "image") continue;
      const handoffUrl = handoffUrls[imageIndex];
      imageIndex += 1;
      if (handoffUrl !== undefined) urls.set(attachment.id, handoffUrl);
    }
  }
  return urls;
}

/**
 * A sent image keeps showing its local blob preview until the server's copy has loaded, so the
 * timeline does not flash an empty frame. The handoff ends, and its blobs are revoked, once the
 * server previews load.
 */
export function useAttachmentPreviewHandoff(input: AttachmentPreviewHandoffInput) {
  const {
    environmentId,
    threadId,
    serverVisibleTurnItems,
    serverMessages,
    blobPreviews,
    setOptimisticUserMessages,
  } = input;
  const handoffByMessageId = input.handoff;

  // Blob URLs are a browser resource owned per thread; leaving the thread or the view ends them.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- revokes the thread's blob preview URLs when the thread changes or the view unmounts
  useEffect(() => () => blobPreviews.revokeThread(threadId), [blobPreviews, threadId]);

  const serverAttachmentResources = selectHandoffImageResources(
    handoffMessages(handoffByMessageId, serverMessages, serverVisibleTurnItems),
    handoffByMessageId,
  );
  const serverAttachmentUrls = useAssetUrls(environmentId, serverAttachmentResources);
  // Derived again after the hook: the compiler cannot memoize a value used across a hook call.
  const messages = handoffMessages(handoffByMessageId, serverMessages, serverVisibleTurnItems);
  const serverAttachmentUrlById = new Map(
    serverAttachmentResources.flatMap((resource, index) => {
      const url = serverAttachmentUrls[index];
      return url ? [[resource.attachmentId, url] as const] : [];
    }),
  );

  const timelineAttachmentUrlById = withHandoffUrls(
    serverAttachmentUrlById,
    messages,
    handoffByMessageId,
  );
  const pendingPreloads = pendingHandoffPreloads(
    messages,
    handoffByMessageId,
    serverAttachmentUrlById,
  );
  const loadedHandoffMessageIds = useAtomValue(
    loadedHandoffMessageIdsAtom(JSON.stringify(pendingPreloads)),
  );
  // The handoff is state of the rendering ChatView, so dropping a loaded one here is React's
  // adjust-state-while-rendering pattern; the preload atom has already revoked its blobs.
  if (loadedHandoffMessageIds.length > 0) {
    setOptimisticUserMessages((state) =>
      loadedHandoffMessageIds.reduce(
        (next, messageId) => dropOptimisticHandoff(next, threadId, messageId),
        state,
      ),
    );
  }

  return { timelineAttachmentUrlById };
}
