"use client";

import { AlertTriangle, ChevronRight, Inbox, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  Avatar as AvatarPrimitive,
  Progress as ProgressPrimitive,
  Separator as SeparatorPrimitive,
} from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/labels";
import { cn, initials } from "@/lib/utils";
import { CountUp } from "@/components/motion";
import { Button } from "./button";

/** Plain numbers and "62%"-style values count up on first view; anything else renders as given. */
function animatedValue(value: ReactNode): ReactNode {
  if (typeof value === "number") return <CountUp value={value} format={(n) => Math.round(n).toLocaleString("en-NG")} />;
  if (typeof value === "string") {
    const m = /^(\d{1,3}(?:,\d{3})*)(%?)$/.exec(value);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      return <CountUp value={n} format={(v) => Math.round(v).toLocaleString("en-NG") + m[2]} />;
    }
  }
  return value;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-surface shadow-sm", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h3 className="text-lg">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

// ─── Badge / status pill ──────────────────────────────────────────────────────

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  info: "bg-info-soft text-info",
  brand: "bg-primary-soft text-brand-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  dark: "bg-secondary text-secondary-foreground",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Pass one of the maps from lib/labels.ts and a value: `<StatusPill map={APPLICATION_STATUS} value={app.status} />`. */
export function StatusPill<K extends string>({
  map,
  value,
  className,
}: {
  map: Record<K, { label: string; tone: Tone }>;
  value: K;
  className?: string;
}) {
  const meta = map[value];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-brand-text",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback className="font-display font-semibold" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function Progress({
  value,
  label,
  className,
  tone = "brand",
}: {
  value: number;
  label?: string;
  className?: string;
  tone?: "brand" | "dark" | "success";
}) {
  const bar = tone === "dark" ? "bg-secondary" : tone === "success" ? "bg-success" : "bg-primary";
  return (
    <ProgressPrimitive.Root
      value={value}
      aria-label={label}
      className={cn("relative h-2 overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full transition-transform duration-700 ease-out", bar)}
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export function Separator({ className, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-md bg-[length:200%_100%]", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--surface-muted) 0%, var(--border) 50%, var(--surface-muted) 100%)",
      }}
    />
  );
}

/** A generic loading layout for a list/table page. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty / error / no-access states ─────────────────────────────────────────

interface StateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

function StateBlock({ title, description, action, icon, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-muted text-muted-foreground [&_svg]:size-6">
        {icon}
      </div>
      <h3 className="mt-4 text-lg">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-[15px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateBlock icon={<Inbox />} {...props} />;
}

export function ErrorState({
  title = "We couldn't load this",
  description = "Check your connection and try again.",
  onRetry,
  className,
}: Partial<StateProps> & { onRetry?: () => void }) {
  return (
    <StateBlock
      icon={<AlertTriangle className="text-danger" />}
      title={title}
      description={description}
      className={className}
      action={
        onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function NoAccess({
  description = "Your account doesn't have access to this page.",
}: {
  description?: string;
}) {
  return (
    <StateBlock
      icon={<Lock />}
      title="You don't have access"
      description={description}
      action={
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      }
    />
  );
}

// ─── Page header + breadcrumbs ────────────────────────────────────────────────

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
            {c.href ? (
              <Link href={c.href} className="rounded hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[34px]">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "brand" | "dark";
  className?: string;
}) {
  const tones = {
    default: "bg-surface border border-border",
    brand: "bg-orange text-[var(--grey-950)]",
    dark: "bg-night-2 text-white",
  };
  return (
    <div className={cn("rounded-xl p-5 shadow-sm", tones[tone], className)}>
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn("text-sm font-semibold", tone === "default" ? "text-muted-foreground" : "opacity-80")}
        >
          {label}
        </p>
        {icon ? <span className="[&_svg]:size-5 opacity-70">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-[34px] leading-none font-semibold tracking-tight tabular-nums">
        {animatedValue(value)}
      </p>
      {hint ? (
        <p className={cn("mt-2 text-sm", tone === "default" ? "text-muted-foreground" : "opacity-80")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
