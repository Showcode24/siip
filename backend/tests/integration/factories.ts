import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { POST as signIn } from "../../app/api/v1/auth/sign-in/route";
import type { UserRole } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { call, cookieFrom } from "./helpers";

const PASSWORD = "Secret123";
let passwordHash: Promise<string> | undefined;

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

/**
 * Creates a verified, consented user directly in the DB (sign-up itself is
 * covered by auth.test.ts) and signs in through the real route.
 */
export async function createUser(role: UserRole, firstName = "Test"): Promise<TestUser> {
  passwordHash ??= hashPassword(PASSWORD);
  const email = `${role.toLowerCase()}-${randomUUID()}@example.test`;
  const user = await db.user.create({
    data: {
      email,
      name: `${firstName} User`,
      role,
      emailVerified: true,
      consentAt: new Date(),
      consentVersion: "test",
    },
  });
  await db.account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: await passwordHash },
  });
  if (role === "GRADUATE") {
    await db.graduateProfile.create({ data: { userId: user.id, firstName, lastName: "User" } });
  }
  const { res } = await call(signIn, { body: { email, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`Test sign-in failed with ${res.status}`);
  return { id: user.id, email, cookie: cookieFrom(res) };
}

export async function graduateIdOf(user: TestUser) {
  const p = await db.graduateProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { id: true } });
  return p.id;
}

/** Fills every field required to apply, without going through the API. */
export async function completeProfile(user: TestUser, state = "Lagos") {
  const graduateId = await graduateIdOf(user);
  const skill = await ensureSkill("Data Entry");
  await db.graduateProfile.update({
    where: { id: graduateId },
    data: {
      phone: "+2348030000000",
      country: "NG",
      city: state,
      workPreference: "HYBRID",
      stateOfResidence: state,
      institution: "University of Ibadan",
      courseOfStudy: "Economics",
      graduationYear: 2025,
      availability: "FULL_TIME",
      cvPublicId: `siip/cvs/${graduateId}/test.pdf`,
      cvUploadedAt: new Date(),
      skills: { create: { skillId: skill.id, level: "INTERMEDIATE" } },
    },
  });
  return graduateId;
}

export async function ensureSkill(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return db.skill.upsert({ where: { slug }, update: {}, create: { name, slug } });
}

const DAY = 24 * 60 * 60 * 1000;

/** A cohort whose application window is open now. */
export async function createOpenCohort(overrides: { capacity?: number; name?: string } = {}) {
  const now = Date.now();
  return db.cohort.create({
    data: {
      name: overrides.name ?? `Cohort ${randomUUID().slice(0, 8)}`,
      slug: `cohort-${randomUUID()}`,
      applicationOpensAt: new Date(now - DAY),
      applicationClosesAt: new Date(now + 14 * DAY),
      trainingStartsAt: new Date(now + 15 * DAY),
      trainingEndsAt: new Date(now + 45 * DAY),
      internshipStartsAt: new Date(now + 50 * DAY),
      internshipEndsAt: new Date(now + 140 * DAY),
      capacity: overrides.capacity ?? 100,
      status: "APPLICATIONS_OPEN",
    },
  });
}
