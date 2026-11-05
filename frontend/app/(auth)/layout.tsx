import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/shell/common";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <main id="main" className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
      <aside className="relative isolate m-2.5 hidden overflow-hidden rounded-[32px] bg-night p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_50%_at_50%_100%,rgb(232_101_12/0.45),transparent_70%),repeating-linear-gradient(90deg,rgb(255_255_255/0.035)_0_1px,transparent_1px_72px)]" />
        <svg
          viewBox="0 0 400 120"
          className="absolute top-[18%] left-1/2 w-[80%] -translate-x-1/2 opacity-80"
          aria-hidden
        >
          <path d="M0 110 Q200 10 400 110" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="10" />
          <path
            d="M90 110a28 28 0 0 1 56 0M172 110a28 28 0 0 1 56 0M254 110a28 28 0 0 1 56 0"
            fill="none"
            stroke="white"
            strokeOpacity=".35"
            strokeWidth="8"
          />
          <path d="M80 118h240" stroke="var(--orange-500)" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <p className="font-display text-4xl leading-tight font-semibold">
          From graduate to hired, one clear step at a time.
        </p>
        <p className="mt-6 flex items-center gap-2 text-[var(--grey-200)]">
          <ShieldCheck className="size-5 text-orange" /> SIIP is free. We never ask graduates to pay.
        </p>
      </aside>
    </div>
  );
}
