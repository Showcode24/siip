import { describe, expect, it, vi } from "vitest";
import { POST as changePassword } from "../../app/api/v1/auth/change-password/route";
import { POST as signIn } from "../../app/api/v1/auth/sign-in/route";
import { POST as contact } from "../../app/api/v1/contact/route";
import { createUser } from "./factories";
import { call } from "./helpers";

process.env.SUPPORT_EMAIL = "help@siip.test";

const sent: Array<{ template: string; to: string; replyTo?: string }> = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string; to: string; replyTo?: string }) => {
    sent.push(input);
    return "logged";
  }),
}));

describe("change password", () => {
  it("needs the current password, then the new one works and the old one doesn't", async () => {
    const user = await createUser("GRADUATE");
    const wrong = await call(changePassword, {
      cookie: user.cookie,
      body: { currentPassword: "Nope12345", newPassword: "Brand1New" },
    });
    expect(wrong.res.status).toBe(400);
    expect(wrong.json.error.message).toBe("Your current password is incorrect");

    const okay = await call(changePassword, {
      cookie: user.cookie,
      body: { currentPassword: "Secret123", newPassword: "Brand1New" },
    });
    expect(okay.res.status).toBe(200);
    expect(okay.res.headers.get("set-cookie")).toBeTruthy();

    expect((await call(signIn, { body: { email: user.email, password: "Secret123" } })).res.status).toBe(401);
    expect((await call(signIn, { body: { email: user.email, password: "Brand1New" } })).res.status).toBe(200);
  });

  it("requires a session", async () => {
    const { res } = await call(changePassword, { body: { currentPassword: "a", newPassword: "Brand1New" } });
    expect(res.status).toBe(401);
  });
});

describe("contact form", () => {
  it("emails SUPPORT_EMAIL with reply-to set to the sender", async () => {
    const { res } = await call(contact, {
      body: {
        name: "Ada Obi",
        email: "ada@example.com",
        topic: "company",
        message: "We'd like to host two interns.",
      },
    });
    expect(res.status).toBe(200);
    expect(sent.at(-1)).toMatchObject({
      template: "contact-message",
      to: "help@siip.test",
      replyTo: "ada@example.com",
    });
  });

  it("rejects a message that is too short", async () => {
    const { res } = await call(contact, {
      body: { name: "Ada", email: "ada@example.com", topic: "other", message: "hi" },
    });
    expect(res.status).toBe(422);
  });
});
