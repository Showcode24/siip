"use client";

// Searchable single-choice picker (WAI-ARIA combobox with a listbox popup).
// Type to filter, arrows to move, Enter to pick, Escape to close. Works inside
// <Field>, which passes id / aria-invalid / aria-describedby to the input.
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Shown when nothing matches the typed text. */
  emptyText?: string;
  id?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const MAX_SHOWN = 80;

export function Combobox({
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Search",
  emptyText = "No matches",
  ...aria
}: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, MAX_SHOWN);
    // Names that start with the query first, then the rest that contain it.
    const starts = options.filter((o) => o.label.toLowerCase().startsWith(q));
    const contains = options.filter((o) => !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, MAX_SHOWN);
  }, [options, query]);

  const choose = (o: ComboboxOption) => {
    onChange(o.value);
    setQuery("");
    setOpen(false);
  };

  const show = (next = true) => {
    setOpen(next);
    if (next) setActive(Math.max(0, matches.findIndex((m) => m.value === value)));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <input
            ref={inputRef}
            {...aria}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder={selected ? selected.label : placeholder}
            value={open ? query : (selected?.label ?? "")}
            onFocus={() => show()}
            onClick={() => show()}
            onBlur={() => {
              setQuery("");
              onBlur?.();
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!open) return show();
                setActive((i) => Math.min(i + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && open) {
                e.preventDefault();
                if (matches[active]) choose(matches[active]);
              } else if (e.key === "Escape" && open) {
                e.preventDefault();
                setOpen(false);
                setQuery("");
              }
            }}
            className={cn(
              "h-12 w-full rounded-md border border-field-edge bg-surface pr-10 pl-3.5 text-foreground outline-none",
              "transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground",
              "focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--primary-soft)]",
              "aria-[invalid=true]:border-danger",
              open && selected && "placeholder:text-foreground/60",
            )}
          />
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target === inputRef.current) e.preventDefault();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 origin-[var(--radix-popover-content-transform-origin)] rounded-lg border border-border bg-surface p-1 shadow-lg data-[state=open]:animate-[pop-in_160ms_var(--ease-out)]"
        >
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto overscroll-contain">
            {matches.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-muted-foreground">{emptyText}</li>
            ) : (
              matches.map((o, i) => (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(o)}
                  ref={(el) => {
                    if (i === active && open) el?.scrollIntoView({ block: "nearest" });
                  }}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-3 text-[15px]",
                    i === active && "bg-surface-muted",
                  )}
                >
                  {o.label}
                  {o.value === value ? <Check className="size-4 text-brand-text" aria-hidden /> : null}
                </li>
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
