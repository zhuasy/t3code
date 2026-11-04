// Adapted from Rare UI (https://rareui.com). Copyright (c) 2026 Swami Malode.
// Licensed under MIT + Commons Clause + Attribution; see LICENSE.rare-ui.

import type { ReactNode } from "react";

export type AiStatusState = "thinking" | "researching" | "analyzing" | "writing" | "done" | "error";

export function AiStatusLabel({ children }: { children: ReactNode }) {
  return <span className="ai-status-label block truncate">{children}</span>;
}

export function AiStatusIcon({ state }: { state: AiStatusState }) {
  return (
    <svg
      aria-hidden
      data-slot="ai-status-icon"
      data-state={state}
      viewBox="0 0 24 24"
      className="ai-status-icon size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {state === "thinking" ? (
        <>
          <path
            d="M11 5Q12 12 19 13Q12 14 11 21Q10 14 3 13Q10 12 11 5Z"
            fill="currentColor"
            stroke="none"
          />
          <path
            d="M18 2Q18.4 4.6 21 5Q18.4 5.4 18 8Q17.6 5.4 15 5Q17.6 4.6 18 2Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      ) : state === "researching" ? (
        <g className="ai-status-search">
          <circle cx={10.5} cy={10.5} r={5.5} />
          <path d="M14.75 14.75L19 19" />
        </g>
      ) : state === "analyzing" ? (
        [6, 12, 18].map((x, index) => (
          <path
            key={x}
            d={`M${x} 19V8`}
            className="ai-status-bar origin-center"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))
      ) : state === "writing" ? (
        <>
          <path d="m14 4 6 6M4 20l5-1L20 8a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L5 15Z" />
          <path d="M3 22h15" pathLength={1} className="ai-status-ink" />
        </>
      ) : state === "done" ? (
        <path d="M5 12.5L10 17.5L19 7" pathLength={1} className="ai-status-ink" />
      ) : (
        <path d="M7 7L17 17M17 7L7 17" />
      )}
    </svg>
  );
}
