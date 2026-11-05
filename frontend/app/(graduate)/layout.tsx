import type { ReactNode } from "react";
import { GraduateShell } from "@/components/shell/graduate-shell";

export default function GraduateLayout({ children }: { children: ReactNode }) {
  return <GraduateShell>{children}</GraduateShell>;
}
