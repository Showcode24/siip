import { isAPIError } from "better-auth/api";
import { getAuth } from "@/server/auth/auth";
import type { CurrentUser } from "@/server/auth/session";
import { signUpContext, type SignUpContext } from "@/server/auth/signup-context";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { AppError, errors } from "@/server/lib/errors";
import type { SignInInput, SignUpInput } from "@/server/validators/auth";
import { rcNumber } from "@siip/shared/validators/company";

/** Converts Better Auth errors into safe AppErrors. */
function mapAuthError(err: unknown): never {
  if (!isAPIError(err)) throw err;
  const code = (err.body as { code?: string } | undefined)?.code;
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      throw errors.conflict("An account with this email already exists");
    case "INVALID_EMAIL_OR_PASSWORD":
      throw new AppError("UNAUTHENTICATED", "Incorrect email or password");
    case "EMAIL_NOT_VERIFIED":
      throw new AppError("EMAIL_NOT_VERIFIED", "Please verify your email. We have sent you a new link.");
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      throw errors.badRequest("This link is invalid or has expired");
    case "FAILED_TO_CREATE_USER":
      throw errors.badRequest("We could not create your account");
    case "INVALID_PASSWORD":
      throw errors.badRequest("Your current password is incorrect");
    case "FAILED_TO_CREATE_SESSION":
      throw new AppError("UNAUTHENTICATED", "Incorrect email or password");
  }
  if (err.statusCode === 401) throw new AppError("UNAUTHENTICATED", "Incorrect email or password");
  if (err.statusCode >= 400 && err.statusCode < 500)
    throw errors.badRequest("Request could not be completed");
  throw err;
}

export async function signUp(input: SignUpInput) {
  const role = input.accountType === "GRADUATE" ? ("GRADUATE" as const) : ("COMPANY_MEMBER" as const);
  if (input.accountType === "COMPANY") await assertRegistrationNumberFree(input.registrationNumber);
  const context: SignUpContext =
    input.accountType === "GRADUATE"
      ? { role, consentVersion: env().CONSENT_VERSION, firstName: input.firstName, lastName: input.lastName }
      : {
          role,
          consentVersion: env().CONSENT_VERSION,
          signupCompany: {
            companyName: input.companyName,
            registrationNumber: input.registrationNumber,
            address: input.address,
            phone: input.phone,
            whatsapp: input.whatsapp,
          },
        };
  // Company accounts are named after the company, not a person.
  const name =
    input.accountType === "GRADUATE" ? `${input.firstName} ${input.lastName}` : input.companyName;
  try {
    const result = await signUpContext.run(context, () =>
      getAuth().api.signUpEmail({ body: { name, email: input.email, password: input.password } }),
    );
    return {
      user: { id: result.user.id, email: result.user.email, role },
      emailVerificationRequired: true,
    };
  } catch (err) {
    mapAuthError(err);
  }
}

/** Refuses a sign-up whose RC number already belongs to a registered company. */
async function assertRegistrationNumberFree(registrationNumber: string) {
  const asRc = rcNumber.safeParse(registrationNumber);
  const taken = await db.company.findFirst({
    where: asRc.success && asRc.data
      ? { rcNumber: asRc.data }
      : { businessRegNumber: { equals: registrationNumber, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) throw errors.conflict("A company with this RC number is already registered on SIIP");
}

/** Returns the user plus the Set-Cookie headers for the new session. */
export async function signIn(input: SignInInput, requestHeaders: Headers) {
  try {
    const { headers, response } = await getAuth().api.signInEmail({
      body: { email: input.email, password: input.password, rememberMe: input.rememberMe ?? true },
      headers: requestHeaders,
      returnHeaders: true,
    });
    const user = await db.user.findUniqueOrThrow({
      where: { id: response.user.id },
      select: { id: true, email: true, name: true, role: true },
    });
    return { user, headers };
  } catch (err) {
    mapAuthError(err);
  }
}

export async function signOut(requestHeaders: Headers) {
  try {
    const { headers } = await getAuth().api.signOut({ headers: requestHeaders, returnHeaders: true });
    return { headers };
  } catch (err) {
    mapAuthError(err);
  }
}

export async function verifyEmail(token: string) {
  try {
    await getAuth().api.verifyEmail({ query: { token } });
  } catch (err) {
    mapAuthError(err);
  }
}

export async function resendVerification(email: string) {
  try {
    await getAuth().api.sendVerificationEmail({ body: { email } });
  } catch {
    // Always succeed: don't reveal whether the email is registered.
  }
}

/** Always succeeds, so the response never reveals whether an email is registered. */
export async function requestPasswordReset(email: string) {
  try {
    await getAuth().api.requestPasswordReset({
      body: { email, redirectTo: `${env().APP_URL}/reset-password` },
    });
  } catch (err) {
    if (!isAPIError(err)) throw err;
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    await getAuth().api.resetPassword({ body: { token, newPassword } });
  } catch (err) {
    mapAuthError(err);
  }
}

/** Signs out every other device, so a stolen session stops working. */
export async function changePassword(
  input: { currentPassword: string; newPassword: string },
  requestHeaders: Headers,
) {
  try {
    // Revoking other sessions issues this device a fresh session cookie.
    const { headers } = await getAuth().api.changePassword({
      body: { ...input, revokeOtherSessions: true },
      headers: requestHeaders,
      returnHeaders: true,
    });
    return { headers };
  } catch (err) {
    mapAuthError(err);
  }
}

export async function getMe(user: CurrentUser) {
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      consentAt: true,
      consentVersion: true,
      createdAt: true,
      signupCompany: true,
      graduateProfile: { select: { id: true, completenessScore: true } },
      companyMember: {
        select: {
          id: true,
          role: true,
          company: { select: { id: true, name: true, verificationStatus: true } },
        },
      },
    },
  });
  return record;
}
