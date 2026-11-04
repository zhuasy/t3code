import {
  EnvironmentId,
  MessageId,
  ThreadId,
  type OrchestrationV2ConversationMessage,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { act, render } from "../../../test/render";
import { AppAtomRegistryProvider } from "../../rpc/atomRegistry";
import {
  createOptimisticBlobPreviews,
  type OptimisticUserMessages,
} from "./optimisticUserMessages";
import { useAttachmentPreviewHandoff } from "./useAttachmentPreviewHandoff";

vi.mock(import("../../assets/assetUrls"), async () => {
  const { useAtomValue } = await import("@effect/atom-react");
  const { Atom } = await import("effect/reactivity");
  const urls = Atom.family((key: string) => Atom.make(JSON.parse(key) as string[]));
  return {
    useAssetUrls: (_environmentId, resources) =>
      useAtomValue(
        urls(
          JSON.stringify(
            resources.map((resource) =>
              resource._tag === "attachment"
                ? `https://assets.test/${resource.attachmentId}`
                : null,
            ),
          ),
        ),
      ),
  };
});

const THREAD = ThreadId.make("handoff-test");
const MESSAGE = MessageId.make("queued-image");
const AT = DateTime.makeUnsafe(0);
const messages: ReadonlyArray<OrchestrationV2ConversationMessage> = [
  {
    id: MESSAGE,
    threadId: THREAD,
    role: "user",
    createdBy: "user",
    creationSource: "web",
    nodeId: null,
    text: "Queued image",
    runId: null,
    createdAt: AT,
    updatedAt: AT,
    streaming: false,
    attachments: [
      {
        type: "image",
        id: "queued-attachment",
        name: "image.png",
        mimeType: "image/png",
        sizeBytes: 1,
      },
    ],
  },
];

function Harness({
  previews,
  revision,
}: {
  previews: ReturnType<typeof createOptimisticBlobPreviews>;
  revision: number;
}) {
  const [state, setState] = useState<OptimisticUserMessages>({
    threadId: THREAD,
    messages: [],
    handoff: { [MESSAGE]: ["blob:queued-image"] },
  });
  const { timelineAttachmentUrlById } = useAttachmentPreviewHandoff({
    environmentId: EnvironmentId.make("handoff-environment"),
    threadId: THREAD,
    serverMessages: messages,
    serverVisibleTurnItems: [],
    handoff: state.handoff,
    blobPreviews: previews,
    setOptimisticUserMessages: setState,
  });
  return (
    <output
      data-testid="handoff"
      data-preview={timelineAttachmentUrlById.get("queued-attachment") ?? "ready"}
    >
      {Object.keys(state.handoff).length}:{revision}
    </output>
  );
}

it("keeps queued previews before timeline rows arrive and settles the compiled hook after preloading", async () => {
  const images: Array<EventTarget & { src: string }> = [];
  using _image = vi.spyOn(globalThis, "Image").mockImplementation(
    class extends EventTarget {
      src = "";
      constructor() {
        super();
        images.push(this);
      }
    } as unknown as typeof Image,
  );
  using revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const previews = createOptimisticBlobPreviews();
  await using screen = await render(
    <AppAtomRegistryProvider>
      <Harness previews={previews} revision={0} />
    </AppAtomRegistryProvider>,
  );
  await expect
    .element(screen.getByTestId("handoff"))
    .toHaveAttribute("data-preview", "blob:queued-image");
  await vi.waitFor(() =>
    expect(images.some((image) => image.src === "https://assets.test/queued-attachment")).toBe(
      true,
    ),
  );
  await screen.rerender(
    <AppAtomRegistryProvider>
      <Harness previews={previews} revision={1} />
    </AppAtomRegistryProvider>,
  );
  await expect.element(screen.getByTestId("handoff")).toHaveTextContent("1:1");
  await act(() => {
    images
      .find((image) => image.src === "https://assets.test/queued-attachment")!
      .dispatchEvent(new Event("load"));
  });
  await expect.element(screen.getByTestId("handoff")).toHaveTextContent("0:1");
  await expect.element(screen.getByTestId("handoff")).toHaveAttribute("data-preview", "ready");
  expect(revoke.mock.calls.map(([url]) => url)).toEqual(["blob:queued-image"]);
  await screen.rerender(
    <AppAtomRegistryProvider>
      <Harness previews={previews} revision={2} />
    </AppAtomRegistryProvider>,
  );
  await expect.element(screen.getByTestId("handoff")).toHaveTextContent("0:2");
});
