// Adapted from Rare UI (https://rareui.com). Copyright (c) 2026 Swami Malode.
// Licensed under MIT + Commons Clause + Attribution; see LICENSE.rare-ui.

import type { CSSProperties } from "react";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { cn } from "~/lib/utils";

type Cell = { x: number; y: number; width: number; height: number };

function buildLayers() {
  let cells: Cell[] = [{ x: 0, y: 0, width: 100, height: 100 }];
  const layers: Cell[][] = [];
  for (let level = 0; level < 6; level++) {
    cells = cells.flatMap((cell) => {
      const wide = cell.width * (16 / 9) >= cell.height;
      return wide
        ? [
            { ...cell, width: cell.width / 2 },
            { ...cell, x: cell.x + cell.width / 2, width: cell.width / 2 },
          ]
        : [
            { ...cell, height: cell.height / 2 },
            { ...cell, y: cell.y + cell.height / 2, height: cell.height / 2 },
          ];
    });
    if (cells.length >= 4) layers.push(cells);
  }
  return layers;
}

const layers = buildLayers();

export function GridReveal({
  ready = false,
  onRevealComplete,
}: {
  ready?: boolean;
  onRevealComplete?: () => void;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (ready && reducedMotion) return null;
  const shownLayers = reducedMotion ? layers.slice(0, 1) : layers;
  return (
    <span
      aria-hidden
      data-slot="grid-reveal"
      data-ready={ready || undefined}
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        ready && "animate-[grid-reveal-finish_600ms_both] motion-reduce:hidden",
      )}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && ready) onRevealComplete?.();
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={cn("size-full", !ready && "bg-muted")}
      >
        {shownLayers.map((cells, level) => (
          <g
            key={cells.length}
            className={cn(
              "origin-center",
              !ready &&
                level > 0 &&
                "animate-[grid-reveal-split_400ms_both] motion-reduce:animate-none",
            )}
            style={{ animationDelay: `${level * 450}ms` }}
          >
            {cells.map((cell, index) => (
              <rect
                key={`${cell.x}:${cell.y}:${cell.width}:${cell.height}`}
                x={cell.x + 0.2}
                y={cell.y + 0.3}
                width={cell.width - 0.4}
                height={cell.height - 0.6}
                rx={0.6}
                className={cn(
                  "fill-muted-foreground/10",
                  ready && "animate-[grid-reveal-cell_350ms_both] motion-reduce:animate-none",
                )}
                style={
                  {
                    opacity: 0.4 + ((index * 17 + level * 13) % 7) / 10,
                    animationDelay: ready ? `${(index % 8) * 25 + level * 15}ms` : undefined,
                  } as CSSProperties
                }
              />
            ))}
          </g>
        ))}
      </svg>
    </span>
  );
}
