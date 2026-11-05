import type { ReactNode } from "react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/chrome";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </>
  );
}
