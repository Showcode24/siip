"use client";

// Interaction layer on Motion (motion/react). Every piece respects
// prefers-reduced-motion by collapsing to an instant change, and animates
// only transform and opacity.
import { animate, AnimatePresence, motion, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const SPRING = { type: "spring", duration: 0.45, bounce: 0.15 } as const;

/** Soft entrance when the route changes (portal content area). */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Children enter one after another (30–50ms apart). Use for card grids and lists. */
export function Stagger({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : "hidden"}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.04 } } }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div", ...rest }: { children: ReactNode; className?: string; as?: "div" | "li" } & Omit<HTMLMotionProps<"div">, "children">) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      variants={{ hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } } }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** A list whose items slide into their new places when one is added or removed. */
export function AnimatedList<T>({ items, getKey, render, className, itemClassName }: { items: T[]; getKey: (t: T) => string; render: (t: T, i: number) => ReactNode; className?: string; itemClassName?: string }) {
  const reduce = useReducedMotion();
  return (
    <ol className={className}>
      <AnimatePresence initial={false}>
        {items.map((t, i) => (
          <motion.li
            key={getKey(t)}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
            transition={SPRING}
            className={itemClassName}
          >
            {render(t, i)}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** A number that counts up to its value the first time it is seen. Tabular figures, no layout shift. */
export function CountUp({ value, format = (n) => String(Math.round(n)), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setShown(value);
    const controls = animate(0, value, { duration: 1.1, ease: EASE_OUT, onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(shown)}
    </span>
  );
}

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  count?: number;
}

/** Segmented filter with a pill that springs to the selected option. Keyboard: arrows move, Home/End jump. */
export function Segmented<V extends string>({ options, value, onChange, label, className }: { options: SegmentOption<V>[]; value: V; onChange: (v: V) => void; label: string; className?: string }) {
  const id = useId();
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-full bg-surface-muted p-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
              if (e.key === "Home") { e.preventDefault(); move(0); }
              if (e.key === "End") { e.preventDefault(); move(options.length - 1); }
            }}
            className={cn("relative flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150", active ? "text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {active ? (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-secondary" transition={reduce ? { duration: 0 } : SPRING} aria-hidden />
            ) : null}
            <span className="relative">{o.label}</span>
            {o.count !== undefined ? <span className="relative tabular-nums opacity-70">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Lifts slightly toward the pointer on fine pointers; a pressable feel for tappable cards. */
export function Pressable({ children, className, ...rest }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** The active-item background in a sidebar; springs from the old item to the new one. */
export function NavHighlight({ id, className }: { id: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      layoutId={`nav-${id}`}
      aria-hidden
      className={cn("absolute inset-0 rounded-lg", className)}
      transition={reduce ? { duration: 0 } : SPRING}
    />
  );
}
