import { EnvironmentId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render, act } from "../../../test/render";

const state = vi.hoisted(() => ({
  review: null as { status: string; commit_sha: string; created_at: string } | null,
  listeners: new Set<() => void>(),
  finish: null as ((result: { _tag: "Success"; value: object }) => void) | null,
}));
vi.mock("~/hooks/useSettings", () => ({
  useEnvironmentSettings: () => ({
    providerInstances: {
      cloud: {
        driver: "acpRegistry",
        enabled: true,
        displayName: "Devin Cloud",
        config: { agentId: "devin" },
      },
    },
  }),
}));
vi.mock("~/state/pullRequests", async () => {
  const { Atom } = await import("effect/reactivity");
  const permission = Atom.make(true);
  return {
    pullRequestEnvironment: {
      devinReview: () => null,
      startDevinReview: { permissionAtom: () => permission },
    },
  };
});
vi.mock("~/state/query", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useEnvironmentQuery: () => {
      const data = useSyncExternalStore(
        (listener) => {
          state.listeners.add(listener);
          return () => state.listeners.delete(listener);
        },
        () => state.review,
      );
      return {
        data,
        error: null,
        isPending: false,
        refresh: () => {
          state.review = {
            status: "pending",
            commit_sha: "abc123",
            created_at: "2026-11-03T12:00:00Z",
          };
          for (const listener of state.listeners) listener();
        },
      };
    },
  };
});
vi.mock("~/state/use-atom-command", () => ({
  useAtomCommand: () => () =>
    new Promise((resolve) => {
      state.finish = resolve;
    }),
}));
vi.mock("~/browser/useOpenLink", () => ({ useOpenLink: () => async () => {} }));
vi.mock("~/hooks/useLiveRefresh", () => ({ useLiveRefresh: () => {} }));

import { DevinReviewButton } from "./DevinReviewDialog";

function setup() {
  state.review = null;
  state.finish = null;
  state.listeners.clear();
}

it("holds the start control while submitting and shows the accepted review status", async () => {
  setup();
  await using screen = await render(
    <DevinReviewButton
      environmentId={EnvironmentId.make("local")}
      prUrl="https://github.com/acme/app/pull/42"
      threadRef={null}
      onViewComments={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Devin Review" }));
  const dialog = page.getByRole("dialog");
  await expect
    .element(dialog.getByRole("status"))
    .toHaveTextContent("No review for the current PR head.");
  await userEvent.click(dialog.getByRole("button", { name: "Start review" }));
  await expect.element(dialog.getByRole("button", { name: "Starting…" })).toBeDisabled();
  await act(() => state.finish?.({ _tag: "Success", value: {} }));
  await expect.element(dialog.getByRole("status")).toHaveTextContent("Review pending");
  await expect.element(dialog.getByRole("button", { name: "Review in progress" })).toBeDisabled();
});
