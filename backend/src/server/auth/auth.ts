import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { signUpContext } from "./signup-context";

const ONE_HOUR = 60 * 60;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function buildAuth() {
  const config = env();
  return betterAuth({
    appName: "SIIP",
    baseURL: config.APP_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.APP_URL],
    database: prismaAdapter(db, { provider: "postgresql" }),
    advanced: {
      database: { generateId: false }, // Prisma's @default(cuid()) generates ids
      useSecureCookies: config.NODE_ENV === "production",
    },
    session: {
      expiresIn: 7 * 24 * ONE_HOUR,
      updateAge: 24 * ONE_HOUR,
    },
    // Rate limiting is done with Upstash in our own route layer.
    rateLimit: { enabled: false },
    user: {
      additionalFields: {
        // input: false => clients can never set these through Better Auth.
        role: { type: "string", input: false, defaultValue: "GRADUATE" },
        deletedAt: { type: "date", input: false, required: false },
        // Set by the create hook below; must be declared or Better Auth drops them.
        consentAt: { type: "date", input: false, required: false },
        consentVersion: { type: "string", input: false, required: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: ONE_HOUR,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        await sendEmail({
          template: "password-reset",
          to: user.email,
          toUserId: user.id,
          // Token is unique per request, so each new request gets its own email.
          idempotencyKey: `password-reset:${token}`,
          props: {
            firstName: firstName(user.name),
            resetUrl: `${config.APP_URL}/reset-password?token=${encodeURIComponent(token)}`,
          },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 24 * ONE_HOUR,
      sendVerificationEmail: async ({ user, token }) => {
        await sendEmail({
          template: "welcome-verify",
          to: user.email,
          toUserId: user.id,
          idempotencyKey: `verify-email:${token.slice(-32)}`,
          props: {
            firstName: firstName(user.name),
            verifyUrl: `${config.APP_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
          },
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const ctx = signUpContext.getStore();
            // Users are only created through our sign-up route (or the seed, which
            // writes directly). Anything else is refused.
            if (!ctx) return false;
            return {
              data: {
                ...user,
                role: ctx.role,
                consentAt: new Date(),
                consentVersion: ctx.consentVersion,
              },
            };
          },
          after: async (user) => {
            const ctx = signUpContext.getStore();
            if (ctx?.role !== "GRADUATE") return;
            await db.graduateProfile.upsert({
              where: { userId: user.id },
              update: {},
              create: { userId: user.id, firstName: ctx.firstName, lastName: ctx.lastName },
            });
          },
        },
      },
      session: {
        create: {
          // Soft-deleted (NDPA deletion request) users can no longer sign in.
          before: async (session) => {
            const owner = await db.user.findUnique({
              where: { id: session.userId },
              select: { deletedAt: true },
            });
            return owner && !owner.deletedAt ? undefined : false;
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof buildAuth>;
let instance: Auth | undefined;

/** Lazily built so importing this module doesn't require env vars (e.g. in unit tests). */
export function getAuth(): Auth {
  instance ??= buildAuth();
  return instance;
}
