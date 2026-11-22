import { AsyncLocalStorage } from "node:async_hooks";
import type { UserRole } from "@/generated/prisma/enums";
import type { SignupCompany } from "@siip/shared/validators/auth";

export interface SignUpContext {
  role: Extract<UserRole, "GRADUATE" | "COMPANY_MEMBER">;
  consentVersion: string;
  // Interns give their name; companies give business details instead.
  firstName?: string;
  lastName?: string;
  signupCompany?: SignupCompany;
}

// Our sign-up route sets the role and consent here; Better Auth's user-create hook
// reads it. This keeps `role` server-controlled (it is not a sign-up input), and
// lets role + consent be written in the same INSERT as the user.
export const signUpContext = new AsyncLocalStorage<SignUpContext>();
