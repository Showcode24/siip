"use client";

// Landing-page motion pieces. Everything is visible without JavaScript and
// with reduced motion; motion only adds the entrance and scroll effects.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () =>
  typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Fades content up once when it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "in">("idle");
  useEffect(() => {
    if (reduced()) return;
    const el = ref.current!;
    if (el.getBoundingClientRect().top < innerHeight * 0.9) return; // already on screen: leave visible
    setState("hidden");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      className={cn(
        "transition-[opacity,transform] duration-[900ms] ease-out",
        state === "hidden" && "translate-y-7 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** Headline whose words rise in one after another. */
export function WordReveal({
  text,
  accent,
  className,
}: {
  text: string;
  accent?: string;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <h1 className={className}>
      {words.map((w, i) => (
        <span key={i}>
          <span
            className={cn(
              "inline-block motion-safe:animate-[word-in_900ms_var(--ease-out)_both]",
              accent && w.replace(/[^\w]/g, "") === accent && "text-orange",
            )}
            style={{ animationDelay: `${150 + i * 70}ms` }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}

/** A fanned 3D arc of cards that tilts gently toward the pointer. */
export function CardArc({
  cards,
}: {
  cards: Array<{ node: ReactNode; x: number; z: number; ry: number; width: number; hideOnMobile?: boolean }>;
}) {
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced() || !finePointer()) return;
    let tx = 0,
      ty = 0,
      x = 0,
      y = 0,
      raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 10;
      ty = (e.clientY / innerHeight - 0.5) * -6;
    };
    const loop = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      if (inner.current) inner.current.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
      raf = requestAnimationFrame(loop);
    };
    addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="relative h-[300px] [perspective:1400px] sm:h-[330px]" aria-hidden>
      <div
        ref={inner}
        className="absolute inset-0 scale-[0.62] [transform-style:preserve-3d] sm:scale-[0.8] lg:scale-100"
      >
        {cards.map((c, i) => (
          <div
            key={i}
            className={cn(
              "absolute top-1/2 left-1/2 motion-safe:animate-[card-in_1100ms_var(--ease-out)_both]",
              c.hideOnMobile && "hidden sm:block",
            )}
            style={
              {
                width: c.width,
                transform: `translate(-50%,-50%) translateX(${c.x}px) translateZ(${c.z}px) rotateY(${c.ry}deg)`,
                animationDelay: `${300 + i * 120}ms`,
              } as CSSProperties
            }
          >
            <div
              className="motion-safe:animate-[bob_6s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 400}ms` }}
            >
              {c.node}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A sentence whose words go from muted to full colour as it scrolls through the screen. */
export function LightUpText({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const words = [...el.querySelectorAll<HTMLElement>("[data-w]")];
    if (reduced()) return;
    words.forEach((w) => w.classList.add("text-border-strong"));
    const update = () => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("text-border-strong", i >= lit));
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return (
    <h2 ref={ref} className={className}>
      {children}
    </h2>
  );
}

/** Wraps each word so LightUpText can light it. */
export function W({ children }: { children: string }) {
  return (
    <>
      {children.split(" ").map((w, i) => (
        <span key={i}>
          <span data-w className="transition-colors duration-500">
            {w}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

/** Sticky phone that changes screen as the steps beside it scroll past. */
export function StickySteps({
  steps,
  screens,
}: {
  steps: Array<{ title: string; body: string }>;
  screens: ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const items = [...listRef.current!.querySelectorAll<HTMLElement>("[data-step]")];
    const update = () => {
      const mid = innerHeight * 0.5;
      let a = 0;
      items.forEach((it, i) => {
        if (it.getBoundingClientRect().top < mid) a = i;
      });
      setActive(a);
      const box = listRef.current!.getBoundingClientRect();
      setFill(Math.min(1, Math.max(0, (mid - box.top) / box.height)));
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return (
    <div className="grid gap-0 lg:grid-cols-2 lg:gap-16">
      <div className="sticky top-20 z-10 h-[58svh] bg-gradient-to-b from-background from-85% to-transparent lg:top-28 lg:h-[calc(100svh-150px)] lg:bg-none">
        <div className="mx-auto grid h-full place-items-center py-4">
          <div
            className="relative aspect-[9/18.5] h-full max-h-[640px] rounded-[44px] bg-night p-3 shadow-lg"
            aria-hidden
          >
            <div className="relative h-full overflow-hidden rounded-[34px] bg-background">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute inset-0 p-4 pt-10 transition-[opacity,transform,filter] duration-500 ease-out",
                    i === active ? "opacity-100" : "scale-[0.97] opacity-0 blur-[4px]",
                  )}
                >
                  {screens[i]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ol ref={listRef} className="relative pl-12">
        <span className="absolute top-2 bottom-2 left-[15px] w-0.5 bg-border" aria-hidden />
        <span
          className="absolute top-2 left-[15px] w-0.5 origin-top bg-orange transition-transform duration-150"
          style={{ height: "calc(100% - 16px)", transform: `scaleY(${fill})` }}
          aria-hidden
        />
        {steps.map((s, i) => (
          <li
            key={i}
            data-step
            className={cn(
              "relative flex min-h-[46svh] flex-col justify-center transition-opacity duration-500 lg:min-h-[62svh]",
              i === active ? "opacity-100" : "opacity-40",
            )}
          >
            <span
              className={cn(
                "absolute -left-12 grid size-8 place-items-center rounded-full border-2 font-display text-sm font-semibold transition-colors",
                i < active
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : i === active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <h3 className="text-[28px] sm:text-[36px]">{s.title}</h3>
            <p className="mt-3 max-w-md text-lg text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A card that tilts toward the pointer with a moving shine. */
export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const zone = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced() || !finePointer()) return;
    const z = zone.current!,
      c = card.current!;
    let rx = 0,
      ry = 0,
      trx = 0,
      tr = 0,
      raf = 0;
    const loop = () => {
      rx += (trx - rx) * 0.12;
      ry += (tr - ry) * 0.12;
      c.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      raf = Math.abs(trx - rx) + Math.abs(tr - ry) > 0.01 ? requestAnimationFrame(loop) : 0;
    };
    const move = (e: PointerEvent) => {
      const r = z.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width,
        py = (e.clientY - r.top) / r.height;
      tr = (px - 0.5) * 14;
      trx = (0.5 - py) * 10;
      c.style.setProperty("--gx", `${px * 100}%`);
      c.style.setProperty("--gy", `${py * 100}%`);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const leave = () => {
      trx = 0;
      tr = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    z.addEventListener("pointermove", move);
    z.addEventListener("pointerleave", leave);
    return () => {
      z.removeEventListener("pointermove", move);
      z.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={zone} className={cn("group [perspective:1200px]", className)}>
      <div ref={card} className="relative [transform-style:preserve-3d]">
        {children}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at var(--gx,50%) var(--gy,0%), var(--sheen), transparent 50%)",
          }}
        />
      </div>
    </div>
  );
}

export interface ScreenStep {
  title: string;
  body: string;
  src: string;
  alt: string;
}

/**
 * The journey, told with real product screens. Desktop: the step list scrolls
 * past a pinned screen that crossfades to match the step in the middle of the
 * viewport. Phone and no-JS: each step shows its own screen inline.
 */
export function ScreenSteps({ steps }: { steps: ScreenStep[] }) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const items = [...listRef.current!.querySelectorAll<HTMLElement>("[data-step]")];
    const update = () => {
      const mid = innerHeight * 0.5;
      let a = 0;
      items.forEach((it, i) => {
        if (it.getBoundingClientRect().top < mid) a = i;
      });
      setActive(a);
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <ol ref={listRef} className="grid">
        {steps.map((s, i) => (
          <li
            key={s.title}
            data-step
            className={cn(
              "flex min-h-0 flex-col justify-center border-t border-border py-10 transition-opacity duration-300 lg:min-h-[52svh] lg:py-0",
              i === active ? "lg:opacity-100" : "lg:opacity-45",
            )}
          >
            <p className="font-display text-lg font-semibold text-brand-text tabular-nums">Step {i + 1}</p>
            <h3 className="mt-2 text-[28px] leading-tight sm:text-[34px]">{s.title}</h3>
            <p className="mt-3 max-w-md text-lg text-muted-foreground">{s.body}</p>
            <Image
              src={s.src}
              alt={s.alt}
              width={2880}
              height={1800}
              sizes="100vw"
              className="mt-6 rounded-lg border border-border lg:hidden"
            />
          </li>
        ))}
      </ol>
      <div className="hidden lg:block">
        <div className="sticky top-[calc(50svh-min(22vw,300px))]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            {steps.map((s, i) => (
              <Image
                key={s.src + i}
                src={s.src}
                alt={i === active ? s.alt : ""}
                aria-hidden={i !== active || undefined}
                fill
                sizes="(min-width: 1024px) 58vw, 1px"
                className={cn(
                  "object-cover object-top transition-[opacity,transform] duration-500 ease-[var(--ease-out)] motion-reduce:transition-none",
                  i === active ? "scale-100 opacity-100" : "scale-[1.02] opacity-0",
                )}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Screens from the SIIP app, shown with sample data.
          </p>
        </div>
      </div>
    </div>
  );
}
