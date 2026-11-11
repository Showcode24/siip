import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Logo } from "@/components/shell/common";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <main id="main" className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
      <aside className="relative isolate m-2.5 hidden overflow-hidden rounded-[32px] bg-night p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 -z-10 bg-[image:var(--night-texture),var(--night-fill)]" />
        <div className="relative mb-10 min-h-0 flex-1">
          <Image
            src="/screens/dashboard-home-phone.png"
            alt="The SIIP home screen on a phone: the step tracker and the next step"
            width={780}
            height={1688}
            sizes="280px"
            className="absolute top-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 rounded-[32px] object-contain object-top shadow-lg ring-4 ring-[var(--grey-950)]"
          />
        </div>
        <p className="font-display text-4xl leading-tight font-semibold">
          Proven skills, put to work, one clear step at a time.
        </p>
        <p className="mt-6 flex items-center gap-2 text-[var(--grey-200)]">
          <ShieldCheck className="size-5 text-orange" /> SIIP is free. We never ask interns to pay.
        </p>
      </aside>
    </div>
  );
}
