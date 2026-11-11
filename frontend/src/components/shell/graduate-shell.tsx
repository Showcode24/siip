"use client";

import { Award, Briefcase, ClipboardCheck, Home, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavHighlight, PageTransition } from "@/components/motion";
import { cn } from "@/lib/utils";
import { Logo, NotificationsBell, ProfileMenu, RoleGate, isActive, type NavItem } from "./common";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/assessments", label: "Tests", icon: ClipboardCheck },
  { href: "/placement", label: "Internship", icon: Briefcase },
  { href: "/certificates", label: "Certificate", icon: Award },
  { href: "/settings", label: "Profile", icon: User },
];
// Bottom bar keeps 5 top-level items (Material guidance); certificate lives in Internship/Home on phones.
const BOTTOM = NAV.filter((n) => n.href !== "/certificates");

/** Graduate portal: sidebar on desktop, bottom tab bar on phones. */
export function GraduateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const focusMode = pathname.startsWith("/assessments/attempt"); // distraction-free exam screen
  return (
    <RoleGate area="graduate">
      {focusMode ? (
        <main id="main">{children}</main>
      ) : (
        <div className="flex min-h-dvh">
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface p-4 lg:flex">
            <div className="px-2 py-2">
              <Logo />
            </div>
            <nav aria-label="Main" className="mt-8">
              <ul className="grid gap-1">
                {NAV.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground",
                          active && "text-foreground hover:bg-transparent",
                        )}
                      >
                        {active ? <NavHighlight id="graduate" className="bg-primary-soft" /> : null}
                        <item.icon className={cn("relative size-[18px]", active && "text-brand-text")} />
                        <span className="relative">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
              <div className="lg:hidden">
                <Logo compact />
              </div>
              <div className="ml-auto flex items-center gap-1">
                <NotificationsBell allHref="/notifications" />
                <ProfileMenu settingsHref="/settings" />
              </div>
            </header>
            <main
              id="main"
              className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:pb-12"
            >
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          >
            <ul className="grid grid-cols-4">
              {BOTTOM.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                        active && "text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-12 place-items-center rounded-full transition-colors",
                          active && "bg-primary-soft",
                        )}
                      >
                        <item.icon className={cn("size-5", active && "text-brand-text")} />
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </RoleGate>
  );
}
