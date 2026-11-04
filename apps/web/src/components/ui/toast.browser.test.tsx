import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { ToastProvider, toastManager } from "./toast";

describe("toastManager", () => {
  it("shows a toast added before any provider mounted", async () => {
    toastManager.add({ type: "info", title: "Raised before the first render" });

    await using _screen = await render(<ToastProvider>{null}</ToastProvider>);

    await expect.element(page.getByText("Raised before the first render")).toBeVisible();
  });

  it("keeps the minimal toast action as an accessible icon button", async () => {
    const onOpen = vi.fn();
    await using _screen = await render(<ToastProvider>{null}</ToastProvider>);
    toastManager.add({
      title: "Thread completed",
      description: "Codemode",
      type: "success",
      data: { appearance: "minimal" },
      actionProps: { children: "Open thread", onClick: onOpen },
    });

    const action = page.getByRole("button", { name: "Open thread" });
    await expect.element(action).toBeVisible();
    expect(action.element().querySelector("svg")).not.toBeNull();
    await action.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
