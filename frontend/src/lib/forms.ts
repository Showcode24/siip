import { ApiError } from "@/client/api/http";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

/**
 * Shows a server error the best way: field errors next to their fields
 * (from VALIDATION_ERROR details), anything else as a toast.
 */
export function handleFormError<T extends FieldValues>(err: unknown, setError?: UseFormSetError<T>) {
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && Array.isArray(err.details) && setError) {
    for (const issue of err.details as Array<{ path: string; message: string }>) {
      setError(issue.path as Path<T>, { message: issue.message });
    }
    return;
  }
  toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
}
