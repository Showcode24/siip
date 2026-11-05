"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/client/api/http";
import { ErrorState, ListSkeleton, NoAccess } from "@/components/ui/display";

/**
 * Renders loading / error / no-access states for a query, and the content once
 * data is there. Keeps every page's state handling identical.
 */
export function QueryState<T>({
  query,
  loading,
  children,
}: {
  query: UseQueryResult<T>;
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <ListSkeleton rows={4} />}</>;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 403)
      return <NoAccess description={query.error.message} />;
    return (
      <ErrorState
        description={query.error instanceof ApiError ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}
