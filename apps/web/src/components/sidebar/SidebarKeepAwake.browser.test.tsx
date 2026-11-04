import { RegistryContext } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";
import { expect, it, vi } from "vite-plus/test";

import { act, render, stubGlobal } from "../../../test/render";
import { SidebarMenu, SidebarProvider } from "../ui/sidebar";
import { SidebarKeepAwake } from "./SidebarKeepAwake";
import { toastManager } from "../ui/toast";

it("follows native changes without letting an older read undo them and waits for toggle completion", async () => {
  let resolveInitial: (enabled: boolean) => void = () => undefined;
  const initial = new Promise<boolean>((resolve) => {
    resolveInitial = resolve;
  });
  let resolveChange: (enabled: boolean) => void = () => undefined;
  const change = new Promise<boolean>((resolve) => {
    resolveChange = resolve;
  });
  let listener: ((enabled: boolean) => void) | undefined;
  const setKeepAwake = vi.fn(() => change);
  using _bridge = stubGlobal("desktopBridge", {
    getClientPlatform: () => "darwin",
    getKeepAwake: () => initial,
    setKeepAwake,
    onKeepAwakeChanged: (next: (enabled: boolean) => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
    getLocalEnvironmentEnabled: () => true,
    getLocalEnvironmentBootstraps: () => [],
  });
  const registry = AtomRegistry.make();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <SidebarProvider>
        <SidebarMenu>
          <SidebarKeepAwake />
        </SidebarMenu>
      </SidebarProvider>
    </RegistryContext.Provider>,
  );
  using notification = vi.spyOn(toastManager, "add");
  const toggle = screen.getByRole("button", { name: "Keep this Mac awake" });
  await expect.element(toggle).toBeDisabled();
  await vi.waitFor(() => expect(listener).toBeDefined());
  await act(async () => {
    listener?.(true);
    resolveInitial(false);
    await initial;
  });
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.element(toggle).toBeEnabled();

  await toggle.click();
  expect(setKeepAwake).toHaveBeenCalledExactlyOnceWith(false);
  await expect.element(toggle).toBeDisabled();
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
  await act(async () => {
    resolveChange(false);
    await change;
  });
  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.element(toggle).toBeEnabled();
  expect(notification).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "success",
      title: "Normal sleep restored",
    }),
  );
  await screen.unmount();
  registry.dispose();
  expect(listener).toBeUndefined();
});
