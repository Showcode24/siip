"use client";

import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  GitMerge,
  History,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type NavSection } from "@/components/shell/app-shell";

const SECTIONS: NavSection[] = [
  { items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true }] },
  {
    title: "Programme",
    items: [
      { href: "/admin/cohorts", label: "Cohorts", icon: Users },
      { href: "/admin/applications", label: "Applications", icon: ClipboardList },
      { href: "/admin/training", label: "Training content", icon: BookOpen },
      { href: "/admin/assessments", label: "Assessments", icon: ClipboardCheck },
    ],
  },
  {
    title: "Placement",
    items: [
      { href: "/admin/companies", label: "Companies", icon: Building2 },
      { href: "/admin/matching", label: "Matching", icon: GitMerge },
      { href: "/admin/placements", label: "Placements", icon: Briefcase },
      { href: "/admin/certificates", label: "Certificates", icon: Award },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/audit", label: "Audit log", icon: History },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell area="admin" sections={SECTIONS} settingsHref="/admin">
      {children}
    </AppShell>
  );
}
