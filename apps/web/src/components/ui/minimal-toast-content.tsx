// Adapted from Rare UI (https://rareui.com). Copyright (c) 2026 Swami Malode.
// Licensed under MIT + Commons Clause + Attribution; see LICENSE.rare-ui.

import { Toast } from "@base-ui/react/toast";
import { ArrowUpRightIcon, CheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "./button";

export function MinimalToastContent({
  type,
  action,
}: {
  type: string | undefined;
  action: ReactNode;
}) {
  const Icon =
    type === "success"
      ? CheckIcon
      : type === "error"
        ? XIcon
        : type === "warning"
          ? TriangleAlertIcon
          : InfoIcon;

  return (
    <>
      <span
        aria-hidden
        data-slot="toast-icon"
        className={cn(
          "grid size-[31px] shrink-0 place-items-center rounded-[9px]",
          type === "success"
            ? "bg-success text-white"
            : type === "error"
              ? "bg-destructive text-white"
              : type === "warning"
                ? "bg-warning text-white"
                : "bg-info text-white",
        )}
      >
        <Icon className="size-[15px] stroke-[3]" />
      </span>
      <div className="flex min-h-[31px] min-w-0 flex-1 flex-col justify-center">
        <Toast.Title
          className="truncate text-xs font-semibold leading-[17px] tracking-[-0.01em]"
          data-slot="toast-title"
        />
        <Toast.Description
          className="line-clamp-2 text-[11px] font-medium leading-[15px] text-muted-foreground wrap-break-word"
          data-slot="toast-description"
        />
      </div>
      {action ? (
        <Toast.Action
          className={buttonVariants({ size: "icon-micro", variant: "ghost-muted" })}
          data-slot="toast-action"
          render={(props) => (
            <button {...props}>
              <ArrowUpRightIcon aria-hidden />
              <span className="sr-only">{action}</span>
            </button>
          )}
        />
      ) : null}
    </>
  );
}
