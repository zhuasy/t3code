// Adapted from Rare UI (https://rareui.com). Copyright (c) 2026 Swami Malode.
// Licensed under MIT + Commons Clause + Attribution; see LICENSE.rare-ui.

import { useState } from "react";
import { ChevronDownIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import type {
  OrchestrationV2TurnItemStatus,
  OrchestrationV2WebSearchResult,
} from "@t3tools/contracts";
import { resolveExternalWebLinkHref } from "../chat/externalLinkContextMenu";
import { cn } from "~/lib/utils";
import { AiStatusIcon, AiStatusLabel } from "./ai-status";

export function WebSearch({
  patterns = [],
  results = [],
  status,
}: {
  patterns?: readonly string[] | undefined;
  results?: readonly OrchestrationV2WebSearchResult[] | undefined;
  status: OrchestrationV2TurnItemStatus;
}) {
  const [open, setOpen] = useState(false);
  const sources = [...new Map(results.map((result) => [JSON.stringify(result), result])).values()];
  const query = patterns.filter(Boolean).join(" · ");
  const searching = status === "running" || status === "pending";
  const label = searching
    ? query
      ? `Searching “${query}”`
      : "Searching the web"
    : status === "failed"
      ? "Search failed"
      : status === "cancelled" || status === "interrupted"
        ? "Search stopped"
        : status === "waiting" || status === "idle"
          ? "Search waiting"
          : sources.length > 0
            ? `Searched ${sources.length} ${sources.length === 1 ? "source" : "sources"}`
            : "Searched the web";
  const hasDetails = sources.length > 0 || patterns.length > 0;

  return (
    <div data-slot="web-search" data-status={status} className="min-w-0 max-w-full py-1 text-sm">
      <button
        type="button"
        disabled={!hasDetails}
        aria-expanded={hasDetails ? open : undefined}
        onClick={() => setOpen(!open)}
        className="flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-left text-secondary-label outline-none transition-colors enabled:cursor-pointer enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {searching ? (
            <AiStatusIcon state="researching" />
          ) : (
            <GlobeIcon className="size-4" aria-hidden />
          )}
        </span>
        <AiStatusLabel key={status}>{label}</AiStatusLabel>
        {sources.length > 0 ? (
          <span aria-hidden className="flex shrink-0 -space-x-1">
            {sources.slice(0, 4).map((source) => (
              <span
                key={JSON.stringify(source)}
                className="grid size-5 place-items-center rounded-full border border-background bg-accent text-2xs font-semibold text-muted-foreground"
              >
                {source.title?.trim().charAt(0).toUpperCase() || "↗"}
              </span>
            ))}
          </span>
        ) : null}
        {hasDetails ? (
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-3 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        ) : null}
      </button>
      {open && hasDetails ? (
        <div className="mt-2 space-y-2">
          {patterns.length > 0 ? (
            <p className="text-xs text-muted-foreground wrap-break-word">{query}</p>
          ) : null}
          {sources.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Web search sources">
              {sources.map((source) => {
                const href = resolveExternalWebLinkHref(source.url);
                const title = source.title?.trim() || source.url || "Search result";
                const host = href ? new URL(href).hostname.replace(/^www\./, "") : undefined;
                return (
                  <li
                    key={JSON.stringify(source)}
                    className="min-w-0 rounded-xl border border-border/60 bg-card p-3 motion-safe:animate-[ai-status-enter_350ms_both]"
                  >
                    {host ? (
                      <p className="mb-1 truncate text-2xs text-muted-foreground">{host}</p>
                    ) : null}
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-1 rounded-sm text-xs font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="line-clamp-2 wrap-break-word">{title}</span>
                        <ExternalLinkIcon aria-hidden className="mt-0.5 size-3 shrink-0" />
                      </a>
                    ) : (
                      <p className="line-clamp-2 text-xs font-semibold wrap-break-word">{title}</p>
                    )}
                    {source.snippet ? (
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground wrap-break-word">
                        {source.snippet}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {searching ? "Waiting for sources…" : "The provider did not return source details."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
