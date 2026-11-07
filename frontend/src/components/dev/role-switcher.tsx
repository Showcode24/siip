"use client";

import { Check, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { USE_MOCKS } from "@/client/api/http";
import { currentPersona, homeFor, isCaptureMode, setPersona, useResetSession } from "@/client/session";
import { cn } from "@/lib/utils";

interface PersonaInfo {
  key: string;
  label: string;
  description: string;
}

/** Dev-only floating switcher to jump between demo accounts. Never rendered in production. */
export function DevRoleSwitcher() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PersonaInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const router = useRouter();
  const reset = useResetSession();
  const [capture, setCapture] = useState<boolean | null>(null);
  useEffect(() => setCapture(isCaptureMode()), []);

  useEffect(() => {
    if (!open || list.length) return;
    import("@/client/mocks/db").then(({ personas }) =>
      setList(
        Object.entries(personas).map(([key, p]) => ({ key, label: p.label, description: p.description })),
      ),
    );
  }, [open, list.length]);
  useEffect(() => setActive(currentPersona()), [open]);

  // Hidden when not mocking, and in screenshot capture mode (?capture=1), decided after mount.
  if (!USE_MOCKS || capture !== false) return null;

  async function choose(key: string | null) {
    setPersona(key);
    setActive(key);
    setOpen(false);
    reset();
    const { mockMe } = await import("@/client/mocks/me");
    router.push(key ? homeFor(mockMe(key)) : "/");
  }

  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[60] lg:bottom-4">
      {open ? (
        <div
          className="mb-3 w-[min(340px,calc(100vw-32px))] animate-fade-up rounded-xl border border-border bg-surface p-2 shadow-lg"
          role="dialog"
          aria-label="Switch demo account"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold">Demo accounts, dev only</p>
            <button
              className="grid size-9 place-items-center rounded-full hover:bg-surface-muted"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.key}
                onClick={() => choose(p.key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted",
                  active === p.key && "bg-primary-soft/60",
                )}
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                  {active === p.key ? <Check className="size-4 text-brand-text" /> : null}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{p.label}</span>
                  <span className="block text-sm text-muted-foreground">{p.description}</span>
                </span>
              </button>
            ))}
            <button
              onClick={() => choose(null)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold hover:bg-surface-muted"
            >
              <span className="size-5" /> Signed out (public site)
            </button>
          </div>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex h-12 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-lg transition-transform active:scale-[0.97]"
        aria-expanded={open}
      >
        <Users className="size-4" /> Switch role
      </button>
    </div>
  );
}
