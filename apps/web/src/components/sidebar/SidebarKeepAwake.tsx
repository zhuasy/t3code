import { CoffeeIcon } from "lucide-react";
import { useState } from "react";

import { desktopKeepAwakeAtom, getDesktopKeepAwakeBridge } from "../../state/desktopKeepAwake";
import { useEnvironmentQuery } from "../../state/query";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SidebarKeepAwake() {
  const bridge = getDesktopKeepAwakeBridge();
  const query = useEnvironmentQuery(bridge ? desktopKeepAwakeAtom : null);
  const [pending, setPending] = useState(false);
  const enabled = query.data === true;

  const toggle = () => {
    if (!bridge || pending) return;
    if (query.error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Keep awake is unavailable",
          description: "Quit and reopen T3 Code to load the desktop controls, then try again.",
        }),
      );
      query.refresh();
      return;
    }
    if (query.data === null) return;
    setPending(true);
    void bridge
      .setKeepAwake(!enabled)
      .then((awake) => {
        query.refresh();
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: awake ? "Keeping this Mac awake" : "Normal sleep restored",
            description: awake
              ? "Your Mac will stay awake until you turn this off or quit T3 Code."
              : "Your Mac will follow its usual sleep settings.",
          }),
        );
      })
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not change keep awake",
            description: error instanceof Error ? error.message : "Try again.",
          }),
        );
      })
      .finally(() => setPending(false));
  };

  if (!bridge) return null;

  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Keep this Mac awake"
              aria-pressed={enabled}
              isActive={enabled}
              variant={enabled ? "attention" : "default"}
              disabled={pending || (query.data === null && !query.error)}
              onClick={toggle}
              size="icon"
            >
              <CoffeeIcon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">
          {query.error
            ? "Could not read keep awake status. Click to retry."
            : enabled
              ? "Keeping this Mac awake. Click to allow sleep."
              : "Keep this Mac awake until T3 Code quits. The display can still sleep."}
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
