"use client";

// Who is signed in. Mock mode: a demo persona chosen with the dev role switcher
// (stored in localStorage). Real mode: GET /api/v1/auth/me via Better Auth cookies.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "./api/types";
import { ApiError, USE_MOCKS, get } from "./api/http";

const KEY = "siip-mock-persona";
export const DEFAULT_PERSONA = "graduate-training";

export function currentPersona(): string | null {
  if (typeof window === "undefined") return DEFAULT_PERSONA;
  const v = localStorage.getItem(KEY);
  return v === "signed-out" ? null : (v ?? DEFAULT_PERSONA);
}

export function setPersona(persona: string | null) {
  localStorage.setItem(KEY, persona ?? "signed-out");
}

async function loadMe(): Promise<Me | null> {
  if (USE_MOCKS) {
    const { mockMe } = await import("./mocks/me");
    return mockMe(currentPersona());
  }
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

/** Use after sign-in/out or a persona switch: drops every cached query. */
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
