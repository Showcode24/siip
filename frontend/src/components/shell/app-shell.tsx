"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { NavHighlight, PageTransition } from "@/components/motion";
import { cn } from "@/lib/utils";
import {
  CommandMenu,
  Logo,
  NotificationsBell,
  ProfileMenu,
  RoleGate,
  isActive,
  type Area,
  type NavItem,
} from "./common";

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Collapsible-sidebar shell used by the company and admin portals. */
export function AppShell({
  area,
  sections,
  settingsHref,
  children,
  banner,
}: {
  area: Area;
  sections: NavSection[];
  settingsHref: string;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const all = sections.flatMap((s) => s.items);

  useEffect(() => setCollapsed(localStorage.getItem(`siip-sidebar-${area}`) === "1"), [area]);
  useEffect(() => setMobileOpen(false), [pathname]);
  const toggle = () => {
    localStorage.setItem(`siip-sidebar-${area}`, collapsed ? "0" : "1");
    setCollapsed(!collapsed);
  };

  const nav = (compact: boolean) => (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && !compact ? (
            <p className="mb-2 px-3 text-[13px] font-medium text-white/55">
              {s.title}
            </p>
          ) : null}
          <ul className="grid gap-1">
            {s.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={compact ? item.label : undefined}
                    className={cn(
                      "relative flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-white/75 transition-colors duration-150 hover:bg-white/8 hover:text-white",
                      active && "text-white hover:bg-transparent",
                      compact && "justify-center px-0",
                    )}
                  >
                    {active ? <NavHighlight id={`${area}-${compact ? "c" : "f"}`} className="bg-white/10" /> : null}
                    <item.icon className={cn("relative size-[18px] shrink-0", active && "text-orange")} />
                    {compact ? <span className="sr-only">{item.label}</span> : <span className="relative">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <RoleGate area={area}>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col bg-night-2 p-3 text-white [--ring:var(--orange-500)] lg:flex",
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <div
            className={cn("flex h-14 items-center", collapsed ? "justify-center" : "justify-between px-2")}
          >
            <Logo inverse compact={collapsed} />
          </div>
          <div className="mt-4 flex-1 overflow-y-auto">{nav(collapsed)}</div>
          <button
            onClick={toggle}
            className="flex h-11 items-center justify-center gap-2 rounded-lg text-sm text-white/60 hover:bg-white/8 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" /> Collapse
              </>
            )}
          </button>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menu">
            <button
              className="absolute inset-0 bg-scrim"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 [--ring:var(--orange-500)] animate-[sheet-in-left_280ms_var(--ease-drawer)] flex-col bg-night-2 p-3 text-white">
              <div className="flex h-14 items-center justify-between px-2">
                <Logo inverse />
                <button
                  className="grid size-11 place-items-center rounded-full hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-4 flex-1 overflow-y-auto">{nav(false)}</div>
            </aside>
          </div>
        ) : null}

        <div className={cn("flex min-w-0 flex-1 flex-col", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <CommandMenu items={all} />
            <div className="ml-auto flex items-center gap-1">
              <NotificationsBell />
              <ProfileMenu settingsHref={settingsHref} />
            </div>
          </header>
          {banner}
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </RoleGate>
  );
}
