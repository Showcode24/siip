"use client";

// Who is signed in: GET /api/v1/auth/me, using Better Auth's cookies.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "./api/types";
import { ApiError, get } from "./api/http";

/** Who is signed in, or null. Pass as `queryFn` wherever `sessionKey` is fetched. */
export async function loadMe(): Promise<Me | null> {
  try {
    return (await get<Me>("/auth/me")).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const sessionKey = ["session"] as const;

/**
 * `signedOut` is true only when the server said so (401). A failed request
 * (weak signal, a phone waking the tab after the file picker) is `isError`,
 * never a sign-out: it is retried, and callers must not send people away.
 */
export function useSession() {
  const q = useQuery({
    queryKey: sessionKey,
    queryFn: loadMe,
    staleTime: Infinity,
    retry: (failures, err) => !(err instanceof ApiError && err.status < 500) && failures < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
  return {
    me: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError && q.data === undefined,
    signedOut: q.isSuccess && q.data === null,
    refetch: q.refetch,
  };
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
