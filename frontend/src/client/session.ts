"use client";

// Who is signed in: GET /api/v1/auth/me, using Better Auth's cookies.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "./api/types";
import { ApiError, get } from "./api/http";

async function loadMe(): Promise<Me | null> {
  try {
    return (await get<Me>("/auth/me")).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const sessionKey = ["session"] as const;

export function useSession() {
  const q = useQuery({ queryKey: sessionKey, queryFn: loadMe, staleTime: Infinity, retry: false });
  return { me: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}

/** Use after sign-in or sign-out: drops every cached query. */
export function useResetSession() {
  const qc = useQueryClient();
  return () => qc.resetQueries();
}

export function isAdmin(me: Me | null) {
  return me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
}

/** Where each role lands after sign-in. */
export function homeFor(me: Me | null): string {
  if (!me) return "/sign-in";
  if (isAdmin(me)) return "/admin";
  if (me.role === "COMPANY_MEMBER") return me.companyMember ? "/company" : "/company/onboarding";
  return "/dashboard";
}
