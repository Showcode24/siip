import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as suggestions } from "../../app/api/v1/admin/matching/suggestions/route";
import { POST as propose } from "../../app/api/v1/admin/matches/route";
import { POST as completePlacement } from "../../app/api/v1/admin/placements/[id]/complete/route";
import { POST as terminatePlacement } from "../../app/api/v1/admin/placements/[id]/terminate/route";
import { GET as getIntern } from "../../app/api/v1/company/interns/[id]/route";
import { POST as accept } from "../../app/api/v1/company/matches/[id]/accept/route";
import { POST as reject } from "../../app/api/v1/company/matches/[id]/reject/route";
import { GET as getMatch } from "../../app/api/v1/company/matches/[id]/route";
import { GET as listMatches } from "../../app/api/v1/company/matches/route";
import { GET as myPlacement } from "../../app/api/v1/graduate/placement/route";
import type { NyscStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { completeProfile, createOpenCohort, createUser, ensureSkill, type TestUser } from "./factories";
import { call } from "./helpers";

const sent: string[] = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string }) => {
    sent.push(input.template);
    return "logged";
  }),
}));

let admin: TestUser;
let owner: TestUser;
let otherOwner: TestUser;
let cohortId: string;
let openingId: string;
let skillId: string;
const apps: Record<string, { user: TestUser; applicationId: string }> = {};

async function verifiedCompany(user: TestUser, name: string) {
  return db.company.create({
    data: {
      name,
      rcNumber: `RC${randomUUID().slice(0, 7).replace(/\D/g, "1")}${Date.now() % 1000}`,
      industry: "Media",
      address: "1 Marina, Lagos",
      state: "Lagos",
      verificationStatus: "VERIFIED",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
}

async function qualifiedGraduate(key: string, state: string, nysc: NyscStatus, withSkill: boolean, approved = true) {
  const user = await createUser("GRADUATE", key);
  const graduateId = await completeProfile(user, state);
  await db.graduateProfile.update({
    where: { id: graduateId },
    data: {
      nyscStatus: nysc,
      reviewStatus: approved ? "APPROVED" : "SUBMITTED",
      ...(withSkill
        ? { skills: { create: { skillId, level: "ADVANCED", status: "VERIFIED", verifiedLevel: "ADVANCED" } } }
        : {}),
    },
  });
  const app = await db.application.create({ data: { graduateId, cohortId, status: "QUALIFIED" } });
  apps[key] = { user, applicationId: app.id };
}

beforeAll(async () => {
  [admin, owner, otherOwner] = await Promise.all([
    createUser("ADMIN"),
    createUser("COMPANY_MEMBER", "Kemi"),
    createUser("COMPANY_MEMBER", "Obi"),
  ]);
  skillId = (await ensureSkill("Content Creation")).id;
  cohortId = (await createOpenCohort()).id;
  const company = await verifiedCompany(owner, "Lagos Media Co");
  await verifiedCompany(otherOwner, "Other Co");
  const opening = await db.internshipOpening.create({
    data: {
      companyId: company.id,
      cohortId,
      title: "Content Intern",
      description: "Create content for our brands every week.",
      slots: 1,
      state: "Lagos",
      workMode: "ONSITE",
      schedule: "FULL_TIME",
      openToNysc: false,
      status: "OPEN",
      createdById: owner.id,
      skills: { create: { skillId, minLevel: "INTERMEDIATE" } },
    },
  });
  openingId = opening.id;
  await qualifiedGraduate("best", "Lagos", "COMPLETED", true);
  await qualifiedGraduate("weak", "Kano", "COMPLETED", false);
  await qualifiedGraduate("spare", "Lagos", "EXEMPTED", false);
  await qualifiedGraduate("corper", "Lagos", "SERVING", true);
  // Verified skill, but SIIP hasn't approved the profile yet.
  await qualifiedGraduate("unreviewed", "Lagos", "COMPLETED", true, false);
});

describe("matching", () => {
  it("ranks qualified graduates and explains the score", async () => {
    const { json } = await call(suggestions, {
      method: "GET",
      cookie: admin.cookie,
      path: `/?openingId=${openingId}`,
    });
    const ranked = json.data.suggestions.map((s: { applicationId: string }) => s.applicationId);
    expect(ranked[0]).toBe(apps.best.applicationId);
    expect(ranked.indexOf(apps.best.applicationId)).toBeLessThan(ranked.indexOf(apps.weak.applicationId));
    // Serving corps member is excluded: the opening is not open to NYSC.
    expect(ranked).not.toContain(apps.corper.applicationId);
    // Interns SIIP hasn't approved never reach companies.
    expect(ranked).not.toContain(apps.unreviewed.applicationId);
    expect(json.data.suggestions[0].breakdown.skills).toMatchObject({ weight: 40, fit: 1 });
    expect(JSON.stringify(json)).not.toContain("+234");

    const asGrad = await call(suggestions, {
      method: "GET",
      cookie: apps.best.user.cookie,
      path: `/?openingId=${openingId}`,
    });
    expect(asGrad.res.status).toBe(403);
  });

  it("proposes matches and notifies the company", async () => {
    sent.length = 0;
    for (const key of ["best", "weak", "spare"]) {
      const { res } = await call(propose, {
        cookie: admin.cookie,
        body: { openingId, applicationId: apps[key].applicationId },
      });
      expect(res.status).toBe(201);
    }
    expect(sent.filter((t) => t === "match-proposed")).toHaveLength(3);
    const again = await call(propose, {
      cookie: admin.cookie,
      body: { openingId, applicationId: apps.best.applicationId },
    });
    expect(again.res.status).toBe(409);
    const unapproved = await call(propose, {
      cookie: admin.cookie,
      body: { openingId, applicationId: apps.unreviewed.applicationId },
    });
    expect(unapproved.res.status).toBe(409);
    const ineligible = await call(propose, {
      cookie: admin.cookie,
      body: { openingId, applicationId: apps.corper.applicationId },
    });
    expect(ineligible.res.status).toBe(400);
  });

  it("shows companies limited profiles and only their own matches", async () => {
    const { json } = await call(listMatches, { method: "GET", cookie: owner.cookie });
    expect(json.data).toHaveLength(3);
    expect(json.data[0].graduate).not.toHaveProperty("phone");
    expect(json.data[0].graduate).not.toHaveProperty("email");
    const theirs = await call(getMatch, {
      method: "GET",
      cookie: otherOwner.cookie,
      params: { id: json.data[0].id },
    });
    expect(theirs.res.status).toBe(404);
  });

  it("returns a rejected graduate to the pool and blocks re-proposing", async () => {
    const match = await db.match.findFirstOrThrow({ where: { applicationId: apps.weak.applicationId } });
    const { json } = await call(reject, {
      cookie: owner.cookie,
      params: { id: match.id },
      body: { reason: "Needs content skills" },
    });
    expect(json.data.status).toBe("COMPANY_REJECTED");
    expect((await db.application.findUniqueOrThrow({ where: { id: apps.weak.applicationId } })).status).toBe(
      "QUALIFIED",
    );
    const again = await call(propose, {
      cookie: admin.cookie,
      body: { openingId, applicationId: apps.weak.applicationId },
    });
    expect(again.res.status).toBe(409);
  });

  it("accepting creates a 3-month placement and fills the opening", async () => {
    const match = await db.match.findFirstOrThrow({ where: { applicationId: apps.best.applicationId } });
    sent.length = 0;
    const { res, json } = await call(accept, { cookie: owner.cookie, params: { id: match.id }, body: {} });
    expect(res.status).toBe(201);
    const months =
      (new Date(json.data.endDate).getUTCFullYear() - new Date(json.data.startDate).getUTCFullYear()) * 12 +
      new Date(json.data.endDate).getUTCMonth() -
      new Date(json.data.startDate).getUTCMonth();
    expect(months).toBe(3);
    expect(sent).toEqual(expect.arrayContaining(["match-accepted", "placement-started"]));

    expect((await db.application.findUniqueOrThrow({ where: { id: apps.best.applicationId } })).status).toBe(
      "PLACED",
    );
    // The only slot is filled: opening closes, the other proposal is withdrawn.
    expect((await db.internshipOpening.findUniqueOrThrow({ where: { id: openingId } })).status).toBe(
      "CLOSED",
    );
    const spare = await db.match.findFirstOrThrow({ where: { applicationId: apps.spare.applicationId } });
    expect(spare.status).toBe("WITHDRAWN");
    expect((await db.application.findUniqueOrThrow({ where: { id: apps.spare.applicationId } })).status).toBe(
      "QUALIFIED",
    );

    const detail = await call(getMatch, { method: "GET", cookie: owner.cookie, params: { id: match.id } });
    expect(detail.json.data.graduate.phone).toBe("+2348030000000");
    expect(detail.json.data.graduate.email).toBe(apps.best.user.email);
  });

  it("shows the graduate their placement and keeps it from other companies", async () => {
    const { json } = await call(myPlacement, { method: "GET", cookie: apps.best.user.cookie });
    expect(json.data.placement).toMatchObject({ status: "ACTIVE", company: { name: "Lagos Media Co" } });
    const other = await call(getIntern, {
      method: "GET",
      cookie: otherOwner.cookie,
      params: { id: json.data.placement.id },
    });
    expect(other.res.status).toBe(404);
  });

  it("completes the placement and the application", async () => {
    const placement = await db.placement.findFirstOrThrow({
      where: { applicationId: apps.best.applicationId },
    });
    const params = { id: placement.id };
    const done = await call(completePlacement, { cookie: admin.cookie, params });
    expect(done.json.data.status).toBe("COMPLETED");
    expect((await db.application.findUniqueOrThrow({ where: { id: apps.best.applicationId } })).status).toBe(
      "COMPLETED",
    );
    const late = await call(terminatePlacement, {
      cookie: admin.cookie,
      params,
      body: { reason: "Too late" },
    });
    expect(late.json.error.code).toBe("INVALID_TRANSITION");
  });
});
