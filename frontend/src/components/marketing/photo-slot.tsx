import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Placeholder for a real photo of interns at work.
 * Replace with <Image src=… /> (next/image) once photos are supplied.
 */
export function PhotoSlot({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Photo placeholder: ${label}`}
      className={cn(
        "grid place-items-center bg-[linear-gradient(160deg,var(--grey-100),var(--orange-100))] p-4 text-center text-[13px] text-[var(--grey-500)] dark:bg-[linear-gradient(160deg,var(--grey-800),var(--primary-soft))] dark:text-[var(--grey-300)]",
        className,
      )}
    >
      <span className="grid justify-items-center gap-2">
        <ImageIcon className="size-5 opacity-60" aria-hidden />
        {label}
      </span>
    </div>
  );
}
