import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** All dates are shown in Nigerian time, whatever the device's timezone. */
const TZ = "Africa/Lagos";

type DateInput = string | number | Date;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

export function formatDate(
  d: DateInput,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  return new Intl.DateTimeFormat("en-NG", { timeZone: TZ, ...opts }).format(toDate(d));
}

export function formatDateTime(d: DateInput) {
  return formatDate(d, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelative(d: DateInput) {
  return formatDistanceToNowStrict(toDate(d), { addSuffix: true });
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-NG").format(n);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** "SECOND_CLASS_UPPER" → "Second class upper". Prefer the label maps in lib/labels.ts. */
export function humanise(value: string) {
  const s = value.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
