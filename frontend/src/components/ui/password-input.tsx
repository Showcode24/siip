"use client";

import { Eye, EyeOff } from "lucide-react";
import { Input } from "./form-controls";

export function PasswordInput({
  show,
  onToggle,
  ...props
}: React.ComponentProps<typeof Input> & { show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className="pr-12" {...props} />
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}
