import type { z } from "zod";
import type { signInSchema, signUpSchema } from "@siip/shared/validators/auth";
import { ApiError, USE_MOCKS, call, mock, post, request } from "./http";
import type { Me } from "./types";

type SignUpInput = z.input<typeof signUpSchema>;
type SignInInput = z.input<typeof signInSchema>;

export const authApi = {
  signUp: (input: SignUpInput) =>
    call(
      () =>
        post<{ user: { id: string; email: string; role: string }; emailVerificationRequired: boolean }>(
          "/auth/sign-up",
          input,
        ),
      async () => {
        const { db } = await import("../mocks/db");
        if (db.users.some((u) => u.email === input.email.toLowerCase()))
          throw new ApiError("CONFLICT", "An account with this email already exists", 409);
        return {
          user: {
            id: "new",
            email: input.email,
            role: input.accountType === "GRADUATE" ? "GRADUATE" : "COMPANY_MEMBER",
          },
          emailVerificationRequired: true,
        };
      },
    ),

  /** Mock mode signs in as the demo persona whose email matches (any password), else the default graduate. */
  signIn: (input: SignInInput) =>
    call(
      () => post<{ user: Pick<Me, "id" | "email" | "name" | "role"> }>("/auth/sign-in", input),
      async () => {
        const [{ db, personas }, { setPersona }] = await Promise.all([
          import("../mocks/db"),
          import("../session"),
        ]);
        const user = db.users.find((u) => u.email === input.email.toLowerCase());
        if (!user) throw new ApiError("UNAUTHENTICATED", "Incorrect email or password", 401);
        const persona = Object.entries(personas).find(([, p]) => p.userId === user.id)?.[0];
        if (!persona) throw new ApiError("UNAUTHENTICATED", "Use a demo account from the role switcher", 401);
        setPersona(persona);
        return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
      },
    ),

  signOut: async () => {
    if (USE_MOCKS) {
      const { setPersona } = await import("../session");
      setPersona(null);
      return mock(() => ({ ok: true }));
    }
    return (await post<{ ok: boolean }>("/auth/sign-out")).data;
  },

  forgotPassword: (email: string) =>
    call(
      () => post<{ message: string }>("/auth/forgot-password", { email }),
      () => ({ message: "If that email is registered, we have sent a reset link." }),
    ),

  resetPassword: (token: string, newPassword: string) =>
    call(
      () => post<{ message: string }>("/auth/reset-password", { token, newPassword }),
      () => ({ message: "Your password has been reset. Please sign in." }),
    ),

  resendVerification: (email: string) =>
    call(
      () => post<{ message: string }>("/auth/resend-verification", { email }),
      () => ({ message: "If that account exists and is unverified, we have sent a new link." }),
    ),

  /** NDPA: download everything we hold. Real mode returns the JSON file. */
  exportMyData: async (): Promise<Blob> => {
    if (USE_MOCKS) {
      const me = await mock(async () =>
        (await import("../mocks/me")).mockMe((await import("../session")).currentPersona()),
      );
      return new Blob(
        [
          JSON.stringify(
            { data: { exportedAt: new Date().toISOString(), ...me }, error: null, meta: null },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
    }
    const res = await fetch("/api/v1/me/data-export", { credentials: "include" });
    if (!res.ok)
      throw new ApiError("INTERNAL_ERROR", "We couldn't prepare your data. Please try again.", res.status);
    return res.blob();
  },

  deleteAccount: (password: string) =>
    call(
      () =>
        request<{ deleted: boolean; anonymiseAfter: string }>("POST", "/me/delete-account", {
          body: { password, confirm: "DELETE" },
        }),
      async () => {
        if (password.length < 8) throw new ApiError("UNAUTHENTICATED", "Incorrect password", 401);
        (await import("../session")).setPersona(null);
        return { deleted: true, anonymiseAfter: new Date(Date.now() + 30 * 86_400_000).toISOString() };
      },
    ),
};
