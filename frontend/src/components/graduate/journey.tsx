import { Check } from "lucide-react";
import { JOURNEY, journeyStage, type JourneyInput } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** The 7 journey stages with the current one highlighted. Horizontal on desktop, compact on phones. */
export function JourneyTracker({ journey, className }: { journey: JourneyInput; className?: string }) {
  const current = journeyStage(journey);
  const ended = current === -1;
  return (
    <div className={className}>
      <ol
        className="grid grid-cols-7 gap-1.5 sm:gap-2"
        aria-label={`Your progress: step ${Math.max(current, 0) + 1} of 7`}
      >
        {JOURNEY.map((s, i) => {
          const done = !ended && i < current;
          const now = !ended && i === current;
          return (
            <li key={s.key} className="min-w-0" aria-current={now ? "step" : undefined}>
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors duration-500",
                  done ? "bg-secondary" : now ? "bg-primary" : "bg-border",
                )}
              />
              <div className="mt-3 hidden items-center gap-1.5 md:flex">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                    done
                      ? "bg-secondary text-secondary-foreground"
                      : now
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-[13px]",
                    now ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              <span className="sr-only">{`${s.label}: ${done ? "done" : now ? "current step" : "to do"}`}</span>
            </li>
          );
        })}
      </ol>
      {!ended ? (
        <p className="mt-3 text-sm text-muted-foreground md:hidden">
          Step {current + 1} of 7:{" "}
          <span className="font-semibold text-foreground">{JOURNEY[current]?.label}</span>
        </p>
      ) : null}
    </div>
  );
}
