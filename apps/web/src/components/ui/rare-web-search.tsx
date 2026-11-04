// Rare UI upstream source: https://github.com/swamimalode07/rare-ui
// Copyright (c) 2026 Swami Malode. See LICENSE.rare-ui.
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
  type Transition,
  type Variants,
} from "motion/react";
import { resolveExternalWebLinkHref } from "../chat/externalLinkContextMenu";
import { observeResize } from "~/lib/observeResize";
import { cn } from "~/lib/utils";

export type WebSearchStatus = "searching" | "done";

export type WebSource = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  favicon?: string;
};

const COLUMNS = 4;
const STEP = 0.3;
const START = 0.08;
const CREEP = 0.25;
const CREEP_SECONDS = 4;
const RING_HOLD = 0.45;
const STACK = 4;
const SPREAD_DELAY = 150;
const LEAVE_DELAY = 150;

const SWAP: Transition = { type: "spring", duration: 0.55, bounce: 0.1 };
const POP: Transition = { type: "spring", duration: 0.5, bounce: 0.4 };
const SPREAD: Transition = { type: "spring", duration: 0.35, bounce: 0 };
const OPEN: Transition = { type: "spring", duration: 0.5, bounce: 0.08 };
const CARD: Transition = { type: "spring", duration: 0.5, bounce: 0.1 };
const STAGGER = 0.045;
const RING: Transition = { type: "spring", duration: 0.6, bounce: 0 };
const INSTANT: Transition = { duration: 0 };

const swapVariants: Variants = {
  enter: { y: 6, opacity: 0, filter: "blur(3px)" },
  center: { y: 0, opacity: 1, filter: "blur(0px)" },
  exit: { y: -6, opacity: 0, filter: "blur(3px)" },
};

const cardVariants: Variants = {
  enter: { opacity: 0, y: 8, scale: 0.97, filter: "blur(6px)" },
  center: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.97, filter: "blur(4px)" },
};
const SHIMMER =
  "linear-gradient(90deg, var(--web-search-ink) 40%, var(--web-search-shine) 50%, var(--web-search-ink) 60%)";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const RING_CIRCLE = { ...STROKE, cx: 14, cy: 14, r: 13, strokeWidth: 1.5 };

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const linkTo = (url: string, linked: boolean) =>
  linked && resolveExternalWebLinkHref(url)
    ? { href: resolveExternalWebLinkHref(url)!, target: "_blank", rel: "noreferrer" }
    : {};
const siteName = (url: string) => {
  const parts = hostOf(url).split(".");
  return (parts.length > 1 ? parts[parts.length - 2] : parts[0]) || "Source";
};

export type WebSearchProps = Omit<ComponentProps<"div">, "children"> & {
  sources: WebSource[];
  status?: WebSearchStatus;
  query?: string;
  label?: string;
  progress?: number;
  linked?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function WebSearch({
  sources,
  status = "done",
  query,
  label,
  progress,
  linked = true,
  open,
  defaultOpen = true,
  onOpenChange,
  className,
  ...props
}: WebSearchProps) {
  const reduced = !!useReducedMotion();
  const [openState, setOpenState] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [measureRef, labelWidth] = useSize<HTMLSpanElement>("width");

  const searching = status === "searching";
  const canExpand = sources.length > 0 || searching;
  const isOpen = canExpand && (open ?? openState);
  const count = sources.length;
  const ring = Math.min(
    1,
    Math.max(0, progress ?? (count === 0 ? START : 1 - (1 - STEP) ** count)),
  );
  const text =
    label ??
    (searching
      ? query
        ? `Searching “${query}”`
        : "Searching the web"
      : `Searched ${count} ${count === 1 ? "site" : "sites"}`);
  const overflow = !expanded && count >= COLUMNS;
  const shown = overflow ? sources.slice(0, COLUMNS - 1) : sources;
  const hidden = overflow ? sources.slice(COLUMNS - 1) : [];
  const skeletons = searching && !overflow ? Math.max(0, COLUMNS - count) : 0;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  const swap = reduced ? INSTANT : SWAP;
  const stagger = (i: number): Transition =>
    reduced
      ? INSTANT
      : {
          ...CARD,
          delay: Math.max(0, i - (expanded ? COLUMNS - 1 : 0)) * STAGGER,
        };

  const cell = (key: string, i: number, child: ReactNode) => (
    <motion.li
      key={key}
      className="group/card"
      layout={!reduced}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={stagger(i)}
    >
      {child}
    </motion.li>
  );

  return (
    <div
      data-slot="web-search"
      data-status={status}
      data-open={isOpen || undefined}
      className={cn("flex w-[560px] max-w-full flex-col text-black dark:text-white", className)}
      {...props}
    >
      <button
        type="button"
        data-slot="web-search-trigger"
        onClick={toggle}
        aria-expanded={canExpand ? isOpen : undefined}
        disabled={!canExpand}
        className="group flex h-10 w-fit max-w-full cursor-pointer items-center gap-2.5 rounded-full bg-[#F4F4F9] pl-1.5 pr-3.5 text-left outline-none transition-[background-color,box-shadow] hover:bg-white hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.04),0_2px_4px_-1px_rgba(0,0,0,0.08)] dark:hover:shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#868593] dark:bg-[#1C1C1C] dark:hover:bg-[#232323]"
      >
        <GlobeTile searching={searching} progress={ring} reduced={reduced} />

        <motion.span
          aria-live="polite"
          className="relative grid min-w-0 overflow-x-clip"
          initial={false}
          animate={{ width: labelWidth ?? "auto" }}
          transition={swap}
        >
          <span
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-[14px] font-semibold"
          >
            {text}
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={text}
              variants={swapVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={swap}
              className="truncate whitespace-nowrap text-[14px] font-semibold"
            >
              {searching ? <Shimmer reduced={reduced}>{text}</Shimmer> : text}
            </motion.span>
          </AnimatePresence>
        </motion.span>

        <FaviconStack sources={sources} reduced={reduced} />

        <motion.span
          className="-ml-0.5 shrink-0 text-[#868593] transition-colors group-hover:text-black dark:group-hover:text-white"
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={reduced ? INSTANT : OPEN}
        >
          <Chevron />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (count > 0 || searching) && (
          <Collapse key="sources" reduced={reduced}>
            <ol
              aria-label="Web search sources"
              data-slot="web-search-sources"
              className="relative grid grid-cols-2 gap-2 pt-2.5 sm:grid-cols-4"
            >
              <AnimatePresence mode="popLayout">
                {shown.map((source, i) =>
                  cell(source.id, i, <SourceCard source={source} index={i + 1} linked={linked} />),
                )}
                {Array.from({ length: skeletons }, (_, i) => (
                  <motion.li
                    key={`skeleton-${count + i}`}
                    aria-hidden
                    layout={!reduced}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={stagger(count + i)}
                  >
                    <SkeletonCard reduced={reduced} delay={i * 0.12} />
                  </motion.li>
                ))}
                {hidden.length > 0 &&
                  cell(
                    "more",
                    COLUMNS - 1,
                    <MoreCard
                      sources={hidden}
                      onClick={() => setExpanded(true)}
                      reduced={reduced}
                    />,
                  )}
                {expanded &&
                  count >= COLUMNS &&
                  cell(
                    "less",
                    count,
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className={cn(
                        CARD_SHELL,
                        "group flex-row items-center justify-center gap-1.5 bg-transparent text-[12.5px] font-semibold text-[#868593] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)] group-hover/card:translate-y-0 hover:bg-[#F4F4F9] hover:text-black hover:shadow-none dark:bg-transparent dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:hover:bg-[#1C1C1C] dark:hover:text-white",
                      )}
                    >
                      <Chevron className="-ml-0.5 rotate-180 transition-transform duration-200 group-hover:-translate-y-px" />
                      Show less
                    </button>,
                  )}
              </AnimatePresence>
            </ol>
          </Collapse>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={14}
      height={14}
      {...STROKE}
      strokeWidth={2.6}
      className={cn("block", className)}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Collapse({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const [ref, height] = useSize<HTMLDivElement>("height");

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: height ?? "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={reduced ? INSTANT : { height: OPEN, opacity: { duration: 0.25 } }}
      className="-mx-1 overflow-hidden"
    >
      <div ref={ref} className="px-1 pb-1">
        {children}
      </div>
    </motion.div>
  );
}
const CARD_SHELL =
  "flex h-[84px] w-full cursor-pointer flex-col rounded-[14px] bg-[#F4F4F9] p-2.5 text-left outline-none transition-[background-color,box-shadow,translate] duration-200 group-hover/card:-translate-y-0.5 hover:bg-white hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.04),0_2px_4px_-1px_rgba(0,0,0,0.08)] dark:hover:shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#868593] dark:bg-[#1C1C1C] dark:hover:bg-[#232323]";

function SourceCard({
  source,
  index,
  linked,
}: {
  source: WebSource;
  index: number;
  linked: boolean;
}) {
  return (
    <a
      data-slot="web-search-source"
      {...linkTo(source.url, linked)}
      className={cn(CARD_SHELL, "group justify-between", !linked && "cursor-default")}
    >
      <span className="line-clamp-2 text-[12.5px] font-semibold leading-[17px] text-black/85 transition-colors group-hover:text-black dark:text-white/85 dark:group-hover:text-white">
        {source.title}
      </span>
      <span className="flex items-center gap-1.5">
        <Favicon source={source} size={16} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#868593]">
          {siteName(source.url)}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-[#868593]/70">{index}</span>
      </span>
    </a>
  );
}

function MoreCard({
  sources,
  onClick,
  reduced,
}: {
  sources: WebSource[];
  onClick: () => void;
  reduced: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${sources.length} more sources`}
      className={cn(CARD_SHELL, "group justify-between")}
    >
      <FaviconStack sources={sources} reduced={reduced} />
      <span className="flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold leading-[17px] text-black/85 transition-colors group-hover:text-black dark:text-white/85 dark:group-hover:text-white">
        <span className="relative inline-grid overflow-hidden tabular-nums">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={sources.length}
              initial={{ y: "100%", opacity: 0, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-100%", opacity: 0, filter: "blur(2px)" }}
              transition={reduced ? INSTANT : SWAP}
            >
              {sources.length}
            </motion.span>
          </AnimatePresence>
        </span>
        more {sources.length === 1 ? "source" : "sources"}
      </span>
    </button>
  );
}

function SkeletonCard({ reduced, delay }: { reduced: boolean; delay: number }) {
  const bar = "rounded-full bg-black/[0.06] dark:bg-white/[0.07]";
  return (
    <div className="relative flex h-[84px] flex-col justify-between overflow-hidden rounded-[14px] bg-[#F4F4F9] p-2.5 dark:bg-[#1C1C1C]">
      <span className="flex flex-col gap-1.5 pt-0.5">
        <span className={cn(bar, "h-2.5 w-[88%]")} />
        <span className={cn(bar, "h-2.5 w-[60%]")} />
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn(bar, "size-3.5")} />
        <span className={cn(bar, "h-2 w-12")} />
      </span>
      {!reduced && (
        <motion.span
          className="absolute inset-0 bg-linear-to-r from-transparent via-white/60 to-transparent dark:via-white/[0.06]"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 1.3,
            ease: "easeInOut",
            repeat: Infinity,
            delay,
          }}
        />
      )}
    </div>
  );
}

function useSize<T extends HTMLElement>(side: "width" | "height") {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<number | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the animated label and source-card container as their DOM size changes
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return observeResize(node, () => setSize(Math.ceil(node.getBoundingClientRect()[side])));
  }, [side]);

  return [ref, size] as const;
}

function useHoverIntent(enterDelay: number) {
  const [active, setActive] = useState(false);
  const timer = useRef(0);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- cancels the pending hover-intent timer when its target unmounts
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const set = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(next), delay);
  };
  const hover = {
    onPointerEnter: (event: ReactPointerEvent) =>
      event.pointerType === "mouse" && set(true, enterDelay),
    onPointerLeave: () => set(false, LEAVE_DELAY),
  };

  return { active, set, hover };
}

function FaviconStack({
  sources,
  reduced,
  size = 20,
}: {
  sources: WebSource[];
  reduced: boolean;
  size?: number;
}) {
  const { active: spread, hover } = useHoverIntent(SPREAD_DELAY);
  const shown = sources.slice(0, STACK);
  const overlap = Math.round(size * 0.3) + 4;
  const shift = spread ? overlap - 2 : 0;

  return (
    <motion.span
      data-slot="web-search-stack"
      {...hover}
      className="flex w-fit shrink-0 items-center"
      initial={false}
      animate={{ paddingRight: shift * Math.max(0, shown.length - 1) }}
      transition={reduced ? INSTANT : SPREAD}
    >
      <AnimatePresence initial={false}>
        {shown.map((source, i) => (
          <motion.span
            key={source.id}
            className="relative rounded-full bg-[#F4F4F9] p-[2px] transition-colors group-hover:bg-white dark:bg-[#1C1C1C] dark:group-hover:bg-[#232323]"
            style={{ zIndex: STACK - i, marginLeft: i === 0 ? 0 : -overlap }}
            initial={{ scale: 0, opacity: 0, x: shift * i }}
            animate={{ scale: 1, opacity: 1, x: shift * i }}
            exit={{ scale: 0, opacity: 0 }}
            transition={reduced ? INSTANT : { default: POP, x: SPREAD }}
          >
            <Favicon source={source} size={size} />
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.span>
  );
}

function Favicon({ source, size }: { source: WebSource; size: number }) {
  const [broken, setBroken] = useState(false);
  const name = siteName(source.url);
  const hue = hash(name) % 360;
  const image = source.favicon && !broken;

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold uppercase leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: image
          ? undefined
          : `linear-gradient(135deg, oklch(0.72 0.15 ${hue}), oklch(0.58 0.17 ${(hue + 30) % 360}))`,
      }}
    >
      {image ? (
        <img
          src={source.favicon}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}

function GlobeTile({
  searching,
  progress,
  reduced,
}: {
  searching: boolean;
  progress: number;
  reduced: boolean;
}) {
  const fill = useMotionValue(searching ? 0 : 1);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives and cancels the imperative Motion progress-ring animation
  useEffect(() => {
    const target = searching ? progress : 1;
    if (reduced) {
      fill.jump(target);
      return;
    }
    let creep: AnimationPlaybackControls | undefined;
    const settle = animate(fill, target, RING);
    if (searching) {
      settle.then(() => {
        creep = animate(fill, target + (1 - target) * CREEP, {
          duration: CREEP_SECONDS,
          ease: "easeOut",
        });
      });
    }
    return () => {
      settle.stop();
      creep?.stop();
    };
  }, [searching, progress, reduced, fill]);

  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#868593] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors group-hover:text-black dark:bg-[#2A2A2A] dark:group-hover:text-white">
      <svg aria-hidden viewBox="0 0 24 24" width={15} height={15} {...STROKE} strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
      <motion.svg
        aria-hidden
        viewBox="0 0 28 28"
        className="absolute inset-0 size-full -rotate-90 text-black dark:text-white"
        initial={false}
        animate={{ opacity: searching ? 1 : 0 }}
        transition={reduced ? INSTANT : { duration: 0.3, delay: searching ? 0 : RING_HOLD }}
      >
        <circle {...RING_CIRCLE} className="opacity-[0.12]" />
        <motion.circle {...RING_CIRCLE} style={{ pathLength: fill }} />
      </motion.svg>
    </span>
  );
}

function Shimmer({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  if (reduced) return <span className="text-[#868593]">{children}</span>;
  return (
    <motion.span
      className="bg-clip-text text-transparent [--web-search-ink:#868593] [--web-search-shine:#000] dark:[--web-search-shine:#fff]"
      style={{ backgroundImage: SHIMMER, backgroundSize: "250% 100%" }}
      initial={{ backgroundPosition: "100% 0" }}
      animate={{ backgroundPosition: "0% 0" }}
      transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}

export { WebSearch };
