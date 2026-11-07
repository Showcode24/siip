"use client";

import type { UserRole } from "@siip/shared/enums";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, LogOut, Monitor, Moon, Search, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authApi } from "@/client/api/auth";
import { notificationsApi } from "@/client/api/graduate";
import { homeFor, isAdmin, useResetSession, useSession } from "@/client/session";
import { useTheme } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Avatar, NoAccess, Skeleton } from "@/components/ui/display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { cn, formatRelative } from "@/lib/utils";

// ─── Logo (text wordmark until the real logo file is added) ───────────────────

export function Logo({
  className,
  inverse = false,
  compact = false,
}: {
  className?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 rounded-md", className)}
      aria-label="SkillzBridge SIIP home"
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-[10px]",
          inverse ? "bg-white/10" : "bg-surface-muted",
        )}
      >
        <svg width="22" height="16" viewBox="0 0 40 26" aria-hidden>
          <path
            d="M2 21 Q20 2 38 21"
            fill="none"
            stroke={inverse ? "var(--foreground-inverse-fixed)" : "var(--grey-700)"}
            strokeWidth="4"
          />
          <path
            d="M10 21a4 4 0 0 1 8 0M22 21a4 4 0 0 1 8 0"
            fill="none"
            stroke={inverse ? "var(--foreground-inverse-fixed)" : "var(--grey-700)"}
            strokeWidth="3"
          />
          <path d="M8 24.5h24" stroke="var(--orange-500)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>
      {compact ? null : (
        <span className="font-display text-[19px] leading-none font-bold tracking-tight">
          <span className={inverse ? "text-orange" : "text-brand-text"}>Skillz</span>
          <span className={inverse ? "text-white" : "text-foreground"}>Bridge</span>
        </span>
      )}
    </Link>
  );
}

// ─── Role gate ────────────────────────────────────────────────────────────────

export type Area = "graduate" | "company" | "admin";

const allowed: Record<Area, (role: UserRole) => boolean> = {
  graduate: (r) => r === "GRADUATE",
  company: (r) => r === "COMPANY_MEMBER",
  admin: (r) => r === "ADMIN" || r === "SUPER_ADMIN",
};

/** Protects a portal. Signed-out users go to sign-in; other roles see "no access". */
export function RoleGate({ area, children }: { area: Area; children: ReactNode }) {
  const { me, isLoading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !me) router.replace("/sign-in");
  }, [isLoading, me, router]);
  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  if (!allowed[area](me.role)) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-lg place-items-center p-6">
        <NoAccess
          description={`This area is for ${area === "graduate" ? "graduates" : area === "company" ? "partner companies" : "SIIP admins"}. Your home is somewhere else.`}
        />
        <Button asChild variant="link">
          <Link href={homeFor(me)}>Go to my dashboard</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Notifications bell ───────────────────────────────────────────────────────

export function NotificationsBell({ allHref }: { allHref?: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const readAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative"
        >
          <Bell />
          {unread ? (
            <span className="absolute top-2 right-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread ? (
            <button
              className="flex items-center gap-1.5 text-sm font-semibold text-brand-text"
              onClick={() => readAll.mutate()}
            >
              <CheckCheck className="size-4" /> Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            items.slice(0, 8).map((n) => (
              <div key={n.id} className="flex gap-3 border-b border-border px-4 py-3 last:border-0">
                <span
                  className={cn(
                    "mt-2 size-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-primary",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {allHref ? (
          <Link
            href={allHref}
            className="block border-t border-border px-4 py-3 text-center text-sm font-semibold text-brand-text hover:bg-surface-muted"
          >
            See all notifications
          </Link>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Profile menu (theme + sign out) ──────────────────────────────────────────

export function ProfileMenu({ settingsHref }: { settingsHref: string }) {
  const { me } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const reset = useResetSession();
  if (!me) return null;
  const subtitle = isAdmin(me)
    ? "SIIP admin"
    : me.companyMember
      ? `${me.companyMember.company.name}, ${me.companyMember.role === "OWNER" ? "Owner" : "Supervisor"}`
      : "Graduate";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full p-1 pr-1 hover:bg-surface-muted sm:pr-3"
          aria-label="Account menu"
        >
          <Avatar name={me.name} size={36} />
          <span className="hidden text-left sm:block">
            <span className="block text-sm leading-tight font-semibold">{me.name}</span>
            <span className="block max-w-40 truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{me.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push(settingsHref)}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {(
          [
            ["light", Sun, "Light"],
            ["dark", Moon, "Dark"],
            ["system", Monitor, "Match my device"],
          ] as const
        ).map(([value, Icon, label]) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={theme === value ? "font-semibold" : undefined}
          >
            <Icon /> {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          danger
          onSelect={async () => {
            await authApi.signOut();
            reset();
            router.push("/sign-in");
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Command menu (Ctrl/Cmd + K) ──────────────────────────────────────────────

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Highlight for nested routes too (default true except for the root). */
  exact?: boolean;
}

export function CommandMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setActive(0), [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-10 w-64 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-muted-foreground hover:border-border-strong md:flex"
      >
        <Search className="size-4" /> Search or jump to…
        <kbd className="ml-auto rounded border border-border px-1.5 text-[11px] font-semibold">Ctrl K</kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Search"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          {/* No open/close animation: this is used many times a day. */}
          <D.Overlay className="fixed inset-0 z-50 bg-scrim-soft" />
          <D.Content
            className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <D.Title className="sr-only">Search pages</D.Title>
            <D.Description className="sr-only">
              Type to filter, use arrow keys to move and Enter to open.
            </D.Description>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && results[active]) go(results[active].href);
                }}
                placeholder="Search pages…"
                className="h-14 flex-1 bg-transparent outline-none"
                role="combobox"
                aria-expanded
                aria-controls="cmd-results"
                aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
              />
            </div>
            <ul id="cmd-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No pages match &ldquo;{q}&rdquo;.
                </li>
              ) : null}
              {results.map((item, i) => (
                <li
                  key={item.href}
                  id={`cmd-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item.href)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-[15px]",
                    i === active && "bg-surface-muted",
                  )}
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </li>
              ))}
            </ul>
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
