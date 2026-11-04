// Adapted from Rare UI (https://rareui.com). Copyright (c) 2026 Swami Malode.
// Licensed under MIT + Commons Clause + Attribution; see LICENSE.rare-ui.

import {
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { cn } from "~/lib/utils";

export type ThemePalette = {
  sidebar: string;
  panel: string;
  border: string;
  strong: string;
  muted: string;
  tile: string;
};

type ThemeOption<Value extends string> = {
  value: Value;
  label: string;
  colors: ThemePalette;
  alternateColors?: ThemePalette;
};

const bar = "block h-[2.2cqw] rounded-full";

function Preview({ colors }: { colors: ThemePalette }) {
  const vars = {
    "--ts-sidebar": colors.sidebar,
    "--ts-panel": colors.panel,
    "--ts-border": colors.border,
    "--ts-strong": colors.strong,
    "--ts-muted": colors.muted,
    "--ts-tile": colors.tile,
  } as CSSProperties;

  return (
    <span
      aria-hidden
      data-slot="theme-selector-preview"
      style={vars}
      className="absolute -bottom-[10cqw] -right-[10cqw] left-[13cqw] top-[13cqw] flex rounded-tl-[5cqw] bg-(--ts-sidebar) shadow-[0_0_0_1px_var(--ts-border),0_1px_2px_rgba(0,0,0,0.06)]"
    >
      <span className="flex w-[25cqw] shrink-0 flex-col px-[3cqw] pb-[14cqw] pt-[4cqw]">
        <span className="flex gap-[1.3cqw] px-[1.2cqw]">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-[2cqw] rounded-full bg-(--ts-muted)" />
          ))}
        </span>
        <span className="mt-[4cqw] flex flex-col gap-[1cqw]">
          <span className="flex h-[4.6cqw] items-center rounded-[1.6cqw] bg-(--ts-muted) px-[1.2cqw]">
            <span className={cn(bar, "w-[10cqw] bg-(--ts-strong)")} />
          </span>
          <span className="flex h-[4.6cqw] items-center px-[1.2cqw]">
            <span className={cn(bar, "w-[13cqw] bg-(--ts-muted)")} />
          </span>
          <span className="flex h-[4.6cqw] items-center px-[1.2cqw]">
            <span className={cn(bar, "w-[8cqw] bg-(--ts-muted)")} />
          </span>
        </span>
        <span className="mt-auto flex items-center gap-[1.6cqw] px-[1.2cqw]">
          <span className="size-[4.4cqw] shrink-0 rounded-full bg-(--ts-strong)" />
          <span className={cn(bar, "w-[7cqw] bg-(--ts-muted)")} />
        </span>
      </span>
      <span className="mt-[3cqw] flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-[4cqw] bg-(--ts-panel) pl-[5cqw] pt-[5cqw] shadow-[0_0_0_1px_var(--ts-border)]">
        <span className="flex flex-col gap-[2cqw]">
          <span className={cn(bar, "w-[11cqw] bg-(--ts-strong)")} />
          <span className={cn(bar, "w-[19cqw] bg-(--ts-muted)")} />
        </span>
        <span className="mt-[5cqw] flex gap-[2.5cqw]">
          {[0, 1, 2].map((tile) => (
            <span
              key={tile}
              className="h-[12cqw] w-[19cqw] shrink-0 rounded-[2.4cqw] bg-(--ts-tile) shadow-[0_0_0_1px_var(--ts-border)]"
            />
          ))}
        </span>
        <span className="mt-[2.5cqw] h-[20cqw] w-[70cqw] shrink-0 rounded-[2.4cqw] bg-(--ts-tile) shadow-[0_0_0_1px_var(--ts-border)]" />
      </span>
    </span>
  );
}

const STEPS = new Map([
  ["ArrowRight", 1],
  ["ArrowDown", 1],
  ["ArrowLeft", -1],
  ["ArrowUp", -1],
]);

const ring =
  "pointer-events-none absolute inset-0 rounded-xl border-2 sm:rounded-2xl transition-opacity duration-150 motion-reduce:transition-none";

type ThemeSelectorProps<Value extends string> = Omit<
  ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  themes: ThemeOption<Value>[];
  value?: Value | null;
  defaultValue?: Value;
  onChange?: (value: Value) => void;
  labels?: boolean;
  disabled?: boolean;
};

export function ThemeSelector<Value extends string>({
  themes,
  value,
  defaultValue,
  onChange,
  labels = true,
  disabled,
  className,
  ...props
}: ThemeSelectorProps<Value>) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? themes[0]?.value);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = value === undefined ? uncontrolled : value;
  const selectedIndex = themes.findIndex((theme) => theme.value === selected);

  const select = (next: Value) => {
    if (next === selected) return;
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEPS.get(event.key);
    let target: number;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = themes.length - 1;
    else if (step) target = (index + step + themes.length) % themes.length;
    else return;
    event.preventDefault();
    items.current[target]?.focus();
    const option = themes[target];
    if (option) select(option.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      aria-disabled={disabled || undefined}
      data-slot="theme-selector"
      {...props}
      className={cn(
        "grid min-w-0 grid-cols-3 gap-4 p-1",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {themes.map((theme, index) => {
        const active = theme.value === selected;

        return (
          <div
            key={theme.value}
            data-slot="theme-selector-option"
            className="flex min-w-0 flex-col items-stretch gap-3"
          >
            <button
              ref={(el) => {
                items.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={theme.label}
              tabIndex={(selectedIndex === -1 ? index === 0 : active) ? 0 : -1}
              disabled={disabled}
              data-slot="theme-selector-item"
              data-state={active ? "checked" : "unchecked"}
              onClick={() => select(theme.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="group relative aspect-[4/3] w-full cursor-pointer rounded-xl outline-none"
            >
              <span className="@container absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl bg-muted transition-colors duration-150 group-hover:bg-accent motion-reduce:transition-none">
                {theme.alternateColors ? (
                  <>
                    <span className="absolute inset-0 [clip-path:inset(0_50%_0_0)]">
                      <Preview colors={theme.colors} />
                    </span>
                    <span className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
                      <Preview colors={theme.alternateColors} />
                    </span>
                  </>
                ) : (
                  <Preview colors={theme.colors} />
                )}
              </span>
              <span
                className={cn(
                  ring,
                  "border-border opacity-0",
                  !active && "group-hover:opacity-100",
                )}
              />
              <span
                data-slot="theme-selector-ring"
                className={cn(ring, "border-ring", active ? "opacity-100" : "opacity-0")}
              />
              <span className="pointer-events-none absolute inset-1 rounded-lg group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-foreground" />
            </button>
            {labels && (
              <span
                aria-hidden
                data-slot="theme-selector-label"
                className={cn(
                  "text-center text-xs font-medium transition-colors duration-150 motion-reduce:transition-none",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {theme.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
