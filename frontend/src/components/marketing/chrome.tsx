"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { homeFor, useSession } from "@/client/session";
import { Logo } from "@/components/shell/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#journey", label: "How it works" },
  { href: "/companies", label: "For companies" },
  { href: "/about", label: "About" },
  { href: "/verify", label: "Verify a certificate" },
];

/** Pages whose hero is dark: the header starts transparent with light text. */
const DARK_HERO = ["/", "/companies"];

export function MarketingHeader() {
  const pathname = usePathname();
  const overDark = DARK_HERO.includes(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { me } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(scrollY > 40);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const light = overDark && !scrolled && !open;
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3">
      <div
        className={cn(
          "mx-auto flex h-16 max-w-6xl items-center gap-6 rounded-full pr-2 pl-4 transition-[background-color,box-shadow] duration-300",
          light ? "bg-transparent" : "bg-surface/95 shadow-md backdrop-blur",
        )}
      >
        <Logo inverse={light} />
        <nav aria-label="Main" className="ml-auto hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-[15px] font-medium transition-opacity hover:opacity-100",
                light ? "text-white/80" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {me ? (
            <Button asChild size="md">
              <Link href={homeFor(me)}>My dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className={cn("hidden sm:inline-flex", light && "text-white hover:bg-white/10")}
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Apply free</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("lg:hidden", light && "text-white hover:bg-white/10")}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav
          aria-label="Mobile"
          className="mx-auto mt-2 max-w-6xl animate-fade-up rounded-xl bg-surface p-2 shadow-lg lg:hidden"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex h-12 items-center rounded-lg px-4 text-base font-medium hover:bg-surface-muted"
            >
              {l.label}
            </Link>
          ))}
          {!me ? (
            <Link
              href="/sign-in"
              className="flex h-12 items-center rounded-lg px-4 text-base font-medium hover:bg-surface-muted"
            >
              Sign in
            </Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[15px] text-muted-foreground">
            SIIP is a free graduate internship programme by SkillzBridge Trades Africa.
          </p>
        </div>
        {[
          {
            title: "Graduates",
            links: [
              ["Apply free", "/sign-up"],
              ["How it works", "/#journey"],
              ["Sign in", "/sign-in"],
            ],
          },
          {
            title: "Companies",
            links: [
              ["Become a partner", "/companies"],
              ["Verify a certificate", "/verify"],
            ],
          },
          {
            title: "SIIP",
            links: [
              ["About", "/about"],
              ["Contact", "/contact"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 grid gap-2">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-[15px] text-muted-foreground hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-border px-6 py-6 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} SkillzBridge Trades Africa</p>
        <p>SIIP is free. We never ask graduates to pay.</p>
      </div>
    </footer>
  );
}

/** Primary call-to-action with the arrow knob from the approved design. */
export function CtaButton({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "dark";
}) {
  return (
    <Button asChild size="lg" variant={tone === "dark" ? "secondary" : "primary"} className="group pr-2">
      <Link href={href}>
        {children}
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full transition-transform duration-300 ease-out group-hover:translate-x-0.5",
            tone === "dark"
              ? "bg-orange text-[var(--grey-950)]"
              : "bg-white text-orange-deep dark:bg-[var(--grey-950)] dark:text-orange",
          )}
        >
          <ArrowRight className="size-4" />
        </span>
      </Link>
    </Button>
  );
}
