import type { z } from "zod";
import type { ContactInput, signInSchema, signUpSchema } from "@siip/shared/validators/auth";
import { ApiError, call, post, request } from "./http";
import type { Me } from "./types";

type SignUpInput = z.input<typeof signUpSchema>;
type SignInInput = z.input<typeof signInSchema>;

export const authApi = {
  signUp: (input: SignUpInput) =>
    call(() =>
      post<{ user: { id: string; email: string; role: string }; emailVerificationRequired: boolean }>(
        "/auth/sign-up",
        input,
      ),
    ),

  signIn: (input: SignInInput) =>
    call(() => post<{ user: Pick<Me, "id" | "email" | "name" | "role"> }>("/auth/sign-in", input)),

  signOut: async () => {
    return (await post<{ ok: boolean }>("/auth/sign-out")).data;
  },

  forgotPassword: (email: string) =>
    call(() => post<{ message: string }>("/auth/forgot-password", { email })),

  resetPassword: (token: string, newPassword: string) =>
    call(() => post<{ message: string }>("/auth/reset-password", { token, newPassword })),

  resendVerification: (email: string) =>
    call(() => post<{ message: string }>("/auth/resend-verification", { email })),

  /** NDPA: download everything we hold, as a JSON file. */
  exportMyData: async (): Promise<Blob> => {
    const res = await fetch("/api/v1/me/data-export", { credentials: "include" });
    if (!res.ok)
      throw new ApiError("INTERNAL_ERROR", "We couldn't prepare your data. Please try again.", res.status);
    return res.blob();
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    call(() => post<{ message: string }>("/auth/change-password", { currentPassword, newPassword })),

  sendContactMessage: (input: ContactInput) => call(() => post<{ message: string }>("/contact", input)),

  deleteAccount: (password: string) =>
    call(() =>
      request<{ deleted: boolean; anonymiseAfter: string }>("POST", "/me/delete-account", {
        body: { password, confirm: "DELETE" },
      }),
    ),
};
