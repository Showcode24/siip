"use client";

import { Check, ChevronDown, Minus } from "lucide-react";
import {
  Checkbox as CheckboxPrimitive,
  Label as LabelPrimitive,
  RadioGroup as RadioPrimitive,
  Switch as SwitchPrimitive,
} from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-border-strong bg-surface px-3.5 text-foreground placeholder:text-muted-foreground " +
  "transition-[border-color,box-shadow] duration-150 outline-none " +
  "focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--primary-soft)] focus-visible:outline-none " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_var(--danger-soft)] " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

/** Native select: fast, accessible and familiar on low-end Android phones. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-12 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root className={cn("text-[15px] font-semibold text-foreground", className)} {...props} />
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer grid size-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] border-border-strong bg-surface transition-colors",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        "relative after:absolute after:-inset-3 after:content-['']", // 44px touch target
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {props.checked === "indeterminate" ? (
          <Minus className="size-3.5" strokeWidth={3} />
        ) : (
          <Check className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-border-strong p-0.5 transition-colors duration-200",
        "data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

export const RadioGroup = ({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) => (
  <RadioPrimitive.Root className={cn("grid gap-2", className)} {...props} />
);

/** A large tappable radio "card", used for choices like account type or availability. */
export function RadioCard({ className, children, ...props }: ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-border-strong bg-surface p-4 text-left transition-[border-color,background-color] duration-150",
        "hover:border-foreground/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary-soft/50",
        className,
      )}
      {...props}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-border-strong in-data-[state=checked]:border-primary">
        <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </RadioPrimitive.Item>
  );
}
