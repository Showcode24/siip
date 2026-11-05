"use client";

import { Briefcase, Clock, GitPullRequest, LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/client/session";
import { AppShell, type NavSection } from "@/components/shell/app-shell";

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/company", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/company/openings", label: "Openings", icon: Briefcase },
      { href: "/company/matches", label: "Candidates", icon: GitPullRequest },
      { href: "/company/interns", label: "Interns", icon: Users },
    ],
  },
  {
    title: "Company",
    items: [
      { href: "/company/team", label: "Team", icon: Users },
      { href: "/company/settings", label: "Company profile", icon: Settings },
    ],
  },
];

export default function CompanyLayout({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname.startsWith("/company/onboarding");
  const company = me?.companyMember?.company;

  // A company account without a company goes to registration first.
  useEffect(() => {
    if (me?.role === "COMPANY_MEMBER" && !me.companyMember && !onboarding)
      router.replace("/company/onboarding");
  }, [me, onboarding, router]);

  const banner =
    company && company.verificationStatus !== "VERIFIED" && !onboarding ? (
      <div
        className="flex items-center gap-3 border-b border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning sm:px-6"
        role="status"
      >
        <Clock className="size-4 shrink-0" />
        <p className="flex-1 font-medium">
          {company.verificationStatus === "PENDING"
            ? "We're verifying your company. You can draft openings now and publish them once verified."
            : `Your company is ${company.verificationStatus.toLowerCase()}. Some actions are paused.`}
        </p>
        <Link href="/company/onboarding" className="font-semibold underline underline-offset-4">
          Details
        </Link>
      </div>
    ) : null;

  return (
    <AppShell area="company" sections={SECTIONS} settingsHref="/company/settings" banner={banner}>
      {children}
    </AppShell>
  );
}
