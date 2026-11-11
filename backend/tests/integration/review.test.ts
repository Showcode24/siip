import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as decide } from "../../app/api/v1/admin/reviews/[id]/decision/route";
import { GET as getReview } from "../../app/api/v1/admin/reviews/[id]/route";
import { POST as decideSkill } from "../../app/api/v1/admin/reviews/[id]/skills/[skillId]/route";
import { GET as queue } from "../../app/api/v1/admin/reviews/route";
import { GET as suggestions } from "../../app/api/v1/admin/matching/suggestions/route";
import { db } from "@/server/db";
import { anonymiseDeletedUsers } from "@/server/services/cron.service";
import {
  completeProfile,
  createOpenCohort,
  createUser,
  ensureSkill,
  type TestUser,
} from "./factories";
import { call } from "./helpers";

const sent: Array<{ template: string; to: string; props: Record<string, unknown> }> = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string; to: string; props: Record<string, unknown> }) => {
    sent.push(input);
    return "logged";
  }),
}));
vi.mock("@/server/storage/cloudinary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/storage/cloudinary")>()),
  deleteAsset: vi.fn(async () => undefined),
}));

let admin: TestUser;
let intern: TestUser;
let graduateId: string;
let expertSkill: string;
let beginnerSkill: string;

/** An intern who sent two skills with proof for review. */
async function submittedIntern(name: string) {
  const user = await createUser("GRADUATE", name);
  const id = await completeProfile(user);
  await db.graduateSkill.deleteMany({ where: { graduateId: id } });
  const [design, excel] = await Promise.all([ensureSkill("Graphic Design"), ensureSkill("Microsoft Excel")]);
  const a = await db.graduateSkill.create({
    data: {
      graduateId: id,
      skillId: design.id,
      level: "EXPERT",
      documents: { create: { kind: "LINK", url: "https://www.coursera.org/verify/A1" } },
    },
  });
  const b = await db.graduateSkill.create({
    data: {
      graduateId: id,
      skillId: excel.id,
      level: "BEGINNER",
      documents: { create: { kind: "LINK", url: "https://www.udemy.com/certificate/B2" } },
    },
  });
  await db.graduateProfile.update({
    where: { id },
    data: { reviewStatus: "SUBMITTED", submittedAt: new Date() },
  });
  return { user, id, a: a.id, b: b.id };
}

beforeAll(async () => {
  admin = await createUser("ADMIN");
  const s = await submittedIntern("Ngozi");
  [intern, graduateId, expertSkill, beginnerSkill] = [s.user, s.id, s.a, s.b];
});

const skillCall = (skillId: string, body: unknown) =>
  call(decideSkill, { cookie: admin.cookie, params: { id: graduateId, skillId }, body });
const decision = (body: unknown, id = graduateId) => call(decide, { cookie: admin.cookie, params: { id }, body });

describe("admin review queue", () => {
  it("lists interns waiting for review, oldest first, for admins only", async () => {
    const { json } = await call(queue, { method: "GET", cookie: admin.cookie });
    const row = json.data.find((r: { id: string }) => r.id === graduateId);
    expect(row).toMatchObject({ reviewStatus: "SUBMITTED", skills: { total: 2, pending: 2, documents: 2 } });
    expect((await call(queue, { method: "GET", cookie: intern.cookie })).res.status).toBe(403);

    const detail = await call(getReview, { method: "GET", cookie: admin.cookie, params: { id: graduateId } });
    expect(detail.json.data.skills.map((s: { name: string }) => s.name)).toEqual(["Graphic Design", "Microsoft Excel"]);
    expect(detail.json.data.skills[0].documents[0].url).toContain("coursera.org");
  });

  it("verifies a skill at the claimed level or lower, never higher", async () => {
    const tooHigh = await skillCall(beginnerSkill, { decision: "VERIFY", level: "INTERMEDIATE" });
    expect(tooHigh.res.status).toBe(422);

    const lower = await skillCall(expertSkill, { decision: "VERIFY", level: "INTERMEDIATE" });
    expect(lower.res.status).toBe(200);
    expect(lower.json.data).toMatchObject({ status: "VERIFIED", level: "EXPERT", verifiedLevel: "INTERMEDIATE" });

    const log = await db.auditLog.findFirst({ where: { action: "skill.verified", entityId: expertSkill } });
    expect(log?.metadata).toMatchObject({ claimedLevel: "EXPERT", lowerThanClaimed: true });
  });

  it("won't approve while a skill is undecided, and rejection needs a reason", async () => {
    const early = await decision({ action: "APPROVE" });
    expect(early.res.status).toBe(409);

    const noReason = await skillCall(beginnerSkill, { decision: "REJECT", reason: "no" });
    expect(noReason.res.status).toBe(422);
    const rejected = await skillCall(beginnerSkill, {
      decision: "REJECT",
      reason: "The certificate is in someone else's name.",
    });
    expect(rejected.json.data).toMatchObject({ status: "REJECTED", verifiedLevel: null });
    const log = await db.auditLog.findFirst({ where: { action: "skill.rejected", entityId: beginnerSkill } });
    expect(log?.metadata).toMatchObject({ reason: "The certificate is in someone else's name." });
  });

  it("approves the profile, tells the intern, and logs who did it", async () => {
    sent.length = 0;
    const { res, json } = await decision({ action: "APPROVE" });
    expect(res.status).toBe(200);
    expect(json.data.reviewStatus).toBe("APPROVED");
    expect(sent.map((e) => [e.template, e.props.verifiedSkills])).toEqual([["profile-approved", ["Graphic Design"]]]);
    expect(await db.notification.count({ where: { userId: intern.id, type: "profile.approved" } })).toBe(1);
    // Approved means on the waiting list that matching draws from (no cohort needed).
    const onList = await db.application.findFirstOrThrow({ where: { graduateId }, include: { events: true } });
    expect(onList).toMatchObject({ status: "QUALIFIED", cohortId: null });
    expect(onList.events[0].note).toContain("waiting list");
    const log = await db.auditLog.findFirst({ where: { action: "profile.approved", entityId: graduateId } });
    expect(log?.actorId).toBe(admin.id);
    expect(json.data.history.map((h: { action: string }) => h.action)).toEqual(
      expect.arrayContaining(["profile.approved", "skill.rejected", "skill.verified"]),
    );
  });

  it("puts the approved intern in front of companies, with no cohort", async () => {
    const owner = await createUser("COMPANY_MEMBER", "Lola");
    const company = await db.company.create({
      data: {
        name: "Remote Studio",
        country: "GB",
        city: "London",
        timeZone: "Europe/London",
        businessRegNumber: `GB${Date.now() % 1_000_000}`,
        industry: "Design",
        address: "1 High Street",
        verificationStatus: "VERIFIED",
        members: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    const design = await ensureSkill("Graphic Design");
    const opening = await db.internshipOpening.create({
      data: {
        companyId: company.id,
        title: "Design Intern",
        description: "Design social posts for our clients every week.",
        slots: 1,
        workMode: "REMOTE",
        schedule: "FULL_TIME",
        status: "OPEN",
        createdById: owner.id,
        skills: { create: { skillId: design.id, minLevel: "INTERMEDIATE", required: true } },
      },
    });
    const { json } = await call(suggestions, {
      method: "GET",
      cookie: admin.cookie,
      path: `/?openingId=${opening.id}`,
    });
    const app = await db.application.findFirstOrThrow({ where: { graduateId, status: "QUALIFIED" } });
    expect(json.data.suggestions.map((x: { applicationId: string }) => x.applicationId)).toContain(app.id);
  });

  it("sends a profile back for more documents with a note", async () => {
    const other = await submittedIntern("Tunde");
    const noNote = await decision({ action: "REQUEST_CHANGES", note: "more" }, other.id);
    expect(noNote.res.status).toBe(422);
    sent.length = 0;
    const back = await decision(
      { action: "REQUEST_CHANGES", note: "Please add the certificate for Microsoft Excel." },
      other.id,
    );
    expect(back.json.data).toMatchObject({
      reviewStatus: "CHANGES_REQUESTED",
      reviewNote: "Please add the certificate for Microsoft Excel.",
    });
    expect(sent.map((e) => e.template)).toEqual(["profile-changes-requested"]);
  });

  it("removes a profile: locks the account, withdraws applications, emails the reason", async () => {
    const r = await submittedIntern("Femi");
    const cohort = await createOpenCohort();
    const app = await db.application.create({ data: { graduateId: r.id, cohortId: cohort.id, status: "SUBMITTED" } });
    expect(await db.session.count({ where: { userId: r.user.id } })).toBeGreaterThan(0);

    const noReason = await decision({ action: "REMOVE", reason: "fake" }, r.id);
    expect(noReason.res.status).toBe(422);
    sent.length = 0;
    const removed = await decision(
      { action: "REMOVE", reason: "None of the certificates could be verified with the issuer." },
      r.id,
    );
    expect(removed.res.status).toBe(200);
    expect(removed.json.data.removedAt).not.toBeNull();
    expect(removed.json.data.deleteAfter).not.toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { id: r.user.id } });
    expect(user.deletedAt).not.toBeNull();
    expect(await db.session.count({ where: { userId: r.user.id } })).toBe(0);
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("WITHDRAWN");
    const email = sent.find((e) => e.template === "profile-removed");
    expect(email?.props).toMatchObject({
      reason: "None of the certificates could be verified with the issuer.",
      deleteAfterDays: 30,
    });

    const { json } = await call(queue, { method: "GET", cookie: admin.cookie, path: "/?queue=REMOVED" });
    expect(json.data.map((x: { id: string }) => x.id)).toContain(r.id);
    const blocked = await call(decideSkill, {
      cookie: admin.cookie,
      params: { id: r.id, skillId: r.a },
      body: { decision: "VERIFY", level: "BEGINNER" },
    });
    expect(blocked.res.status).toBe(409);

    // Reopened within the window: the account works again and the intern is asked for documents.
    const restored = await decision({ action: "RESTORE", note: "Reopened after you sent the issuer's letter." }, r.id);
    expect(restored.json.data).toMatchObject({ removedAt: null, reviewStatus: "CHANGES_REQUESTED" });
    expect((await db.user.findUniqueOrThrow({ where: { id: r.user.id } })).deletedAt).toBeNull();
  });

  it("deletes a removed profile for good once the 30 days have passed", async () => {
    const r = await submittedIntern("Gbenga");
    await decision({ action: "REMOVE", reason: "The portfolio links belong to another designer." }, r.id);
    // Not yet due.
    await anonymiseDeletedUsers(new Date());
    expect(await db.user.findUnique({ where: { id: r.user.id } })).not.toBeNull();

    await anonymiseDeletedUsers(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
    expect(await db.user.findUnique({ where: { id: r.user.id } })).toBeNull();
    expect(await db.graduateProfile.findUnique({ where: { id: r.id } })).toBeNull();
    expect(await db.graduateSkill.count({ where: { graduateId: r.id } })).toBe(0);
    // The record of SIIP's decision survives, without personal data.
    expect(await db.auditLog.count({ where: { action: "profile.purged", entityId: r.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "profile.removed", entityId: r.id } })).toBe(1);
  });
});
