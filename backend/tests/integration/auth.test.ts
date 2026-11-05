import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as me } from "../../app/api/v1/auth/me/route";
import { POST as signIn } from "../../app/api/v1/auth/sign-in/route";
import { POST as signUp } from "../../app/api/v1/auth/sign-up/route";
import { GET as verifyEmail } from "../../app/api/v1/auth/verify-email/route";
import { db } from "@/server/db";
import { call, cookieFrom } from "./helpers";

// Capture outgoing emails instead of sending them.
const sent: Array<{ template: string; props: Record<string, string> }> = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string; props: Record<string, string> }) => {
    sent.push(input);
    return "logged";
  }),
}));

const password = "Secret123";

async function signUpAndVerify(email: string, accountType: "GRADUATE" | "COMPANY") {
  const { res } = await call(signUp, {
    body: { accountType, firstName: "Ada", lastName: "Obi", email, password, consent: true },
  });
  expect(res.status).toBe(201);
  const verifyUrl = new URL(sent.findLast((e) => e.template === "welcome-verify")!.props.verifyUrl);
  const verified = await call(verifyEmail, { method: "GET", path: verifyUrl.pathname + verifyUrl.search });
  expect(verified.res.headers.get("location")).toContain("verified=1");
}

beforeEach(() => {
  sent.length = 0;
});

describe("auth", () => {
  it("signs up a graduate with consent, verifies email, signs in and reads /me", async () => {
    await signUpAndVerify("ada.grad@example.com", "GRADUATE");

    const signedIn = await call(signIn, { body: { email: "ada.grad@example.com", password } });
    expect(signedIn.res.status).toBe(200);
    const cookie = cookieFrom(signedIn.res);
    expect(cookie).toContain("session_token");

    const { json } = await call(me, { method: "GET", cookie });
    expect(json.data).toMatchObject({ email: "ada.grad@example.com", role: "GRADUATE", emailVerified: true });
    expect(json.data.consentAt).toBeTruthy();
    expect(json.data.graduateProfile).toBeTruthy();
  });

  it("gives company sign-ups the COMPANY_MEMBER role and no graduate profile", async () => {
    await signUpAndVerify("hr@company.example.com", "COMPANY");
    const user = await db.user.findUniqueOrThrow({
      where: { email: "hr@company.example.com" },
      include: { graduateProfile: true },
    });
    expect(user.role).toBe("COMPANY_MEMBER");
    expect(user.graduateProfile).toBeNull();
  });

  it("ignores attempts to self-assign a role", async () => {
    const { res } = await call(signUp, {
      body: {
        accountType: "GRADUATE",
        firstName: "X",
        lastName: "Y",
        email: "sneaky@example.com",
        password,
        consent: true,
        role: "SUPER_ADMIN",
      },
    });
    expect(res.status).toBe(201);
    const user = await db.user.findUniqueOrThrow({ where: { email: "sneaky@example.com" } });
    expect(user.role).toBe("GRADUATE");
  });

  it("requires consent", async () => {
    const { res, json } = await call(signUp, {
      body: {
        accountType: "GRADUATE",
        firstName: "X",
        lastName: "Y",
        email: "noconsent@example.com",
        password,
        consent: false,
      },
    });
    expect(res.status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks sign-in before email verification", async () => {
    await call(signUp, {
      body: {
        accountType: "GRADUATE",
        firstName: "X",
        lastName: "Y",
        email: "unverified@example.com",
        password,
        consent: true,
      },
    });
    const { res, json } = await call(signIn, { body: { email: "unverified@example.com", password } });
    expect(res.status).toBe(403);
    expect(json.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("rejects a wrong password with a generic message and no session", async () => {
    await signUpAndVerify("wrongpw@example.com", "GRADUATE");
    const { res, json } = await call(signIn, {
      body: { email: "wrongpw@example.com", password: "Nope12345" },
    });
    expect(res.status).toBe(401);
    expect(json.error.message).toBe("Incorrect email or password");
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("returns 401 from /me without a session", async () => {
    const { res, json } = await call(me, { method: "GET" });
    expect(res.status).toBe(401);
    expect(json).toEqual({
      data: null,
      error: { code: "UNAUTHENTICATED", message: "You need to sign in" },
      meta: null,
    });
  });

  it("refuses sign-in for soft-deleted users", async () => {
    await signUpAndVerify("deleted@example.com", "GRADUATE");
    await db.user.update({ where: { email: "deleted@example.com" }, data: { deletedAt: new Date() } });
    const { res } = await call(signIn, { body: { email: "deleted@example.com", password } });
    expect(res.status).toBe(401);
  });
});
