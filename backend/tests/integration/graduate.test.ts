import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as adminAppDetail } from "../../app/api/v1/admin/applications/[id]/route";
import { POST as adminStatus } from "../../app/api/v1/admin/applications/[id]/status/route";
import { POST as bulkStatus } from "../../app/api/v1/admin/applications/bulk-status/route";
import { GET as adminApps } from "../../app/api/v1/admin/applications/route";
import { POST as cohortStatus } from "../../app/api/v1/admin/cohorts/[id]/status/route";
import { POST as createCohort } from "../../app/api/v1/admin/cohorts/route";
import { GET as openCohorts } from "../../app/api/v1/cohorts/route";
import { GET as myApp } from "../../app/api/v1/graduate/applications/[id]/route";
import { POST as withdraw } from "../../app/api/v1/graduate/applications/[id]/withdraw/route";
import { POST as apply } from "../../app/api/v1/graduate/applications/route";
import { GET as getProfile, PATCH as patchProfile } from "../../app/api/v1/graduate/profile/route";
import { PUT as putSkills } from "../../app/api/v1/graduate/profile/skills/route";
import { POST as confirmUpload } from "../../app/api/v1/graduate/uploads/confirm/route";
import { POST as markRead } from "../../app/api/v1/notifications/[id]/read/route";
import { GET as notifications } from "../../app/api/v1/notifications/route";
import { db } from "@/server/db";
import { call } from "./helpers";
import {
  completeProfile,
  createOpenCohort,
  createUser,
  ensureSkill,
  graduateIdOf,
  type TestUser,
} from "./factories";

const sent: Array<{ template: string; to: string }> = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string; to: string }) => {
    sent.push(input);
    return "logged";
  }),
}));

// Cloudinary is mocked; ownership checks still use the real implementation.
vi.mock("@/server/storage/cloudinary", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/storage/cloudinary")>();
  return {
    ...real,
    confirmUpload: vi.fn(async (kind: "cv", ownerId: string, publicId: string) => {
      real.assertOwnedPublicId(kind, ownerId, publicId);
      return { publicId, url: `https://cdn.test/${publicId}`, bytes: 1000, format: "pdf" };
    }),
    deleteAsset: vi.fn(async () => undefined),
  };
});

let admin: TestUser;
let gradA: TestUser;
let gradB: TestUser;
let company: TestUser;

beforeAll(async () => {
  [admin, gradA, gradB, company] = await Promise.all([
    createUser("ADMIN"),
    createUser("GRADUATE", "Amaka"),
    createUser("GRADUATE", "Bayo"),
    createUser("COMPANY_MEMBER"),
  ]);
});

describe("graduate profile", () => {
  it("updates the profile, normalises the phone and recomputes completeness", async () => {
    const before = await call(getProfile, { method: "GET", cookie: gradA.cookie });
    expect(before.json.data.missingForApplication).toContain("CV (PDF)");

    const { res, json } = await call(patchProfile, {
      method: "PATCH",
      cookie: gradA.cookie,
      body: { phone: "0803 111 2222", stateOfResidence: "Lagos", institution: "UNILAG" },
    });
    expect(res.status).toBe(200);
    expect(json.data.phone).toBe("+2348031112222");
    expect(json.data.completenessScore).toBeGreaterThan(before.json.data.completenessScore);
    expect(json.data).not.toHaveProperty("cvPublicId");
  });

  it("rejects server-owned fields and invalid states", async () => {
    const bad = await call(patchProfile, {
      method: "PATCH",
      cookie: gradA.cookie,
      body: { completenessScore: 100 },
    });
    expect(bad.res.status).toBe(422);
    const state = await call(patchProfile, {
      method: "PATCH",
      cookie: gradA.cookie,
      body: { stateOfResidence: "Texas" },
    });
    expect(state.res.status).toBe(422);
  });

  it("replaces skills and rejects unknown ones", async () => {
    const [excel, sales] = await Promise.all([ensureSkill("Microsoft Excel"), ensureSkill("Sales")]);
    const { json } = await call(putSkills, {
      method: "PUT",
      cookie: gradA.cookie,
      body: {
        skills: [
          { skillId: excel.id, level: "ADVANCED" },
          { skillId: sales.id, level: "BEGINNER" },
        ],
      },
    });
    expect(json.data.skills).toHaveLength(2);
    const unknown = await call(putSkills, {
      method: "PUT",
      cookie: gradA.cookie,
      body: { skills: [{ skillId: "nope", level: "ADVANCED" }] },
    });
    expect(unknown.res.status).toBe(400);
  });

  it("confirms only uploads issued to this graduate", async () => {
    const otherId = await graduateIdOf(gradB);
    const foreign = await call(confirmUpload, {
      cookie: gradA.cookie,
      body: { kind: "cv", publicId: `siip/cvs/${otherId}/x.pdf` },
    });
    expect(foreign.res.status).toBe(403);

    const ownId = await graduateIdOf(gradA);
    const own = await call(confirmUpload, {
      cookie: gradA.cookie,
      body: { kind: "cv", publicId: `siip/cvs/${ownId}/cv.pdf` },
    });
    expect(own.json.data.cv.uploaded).toBe(true);
  });

  it("blocks other roles and anonymous users", async () => {
    expect((await call(getProfile, { method: "GET", cookie: company.cookie })).res.status).toBe(403);
    expect((await call(getProfile, { method: "GET" })).res.status).toBe(401);
  });
});

describe("applications", () => {
  let cohortId: string;
  let appId: string;

  it("refuses an incomplete profile, then accepts a complete one", async () => {
    cohortId = (await createOpenCohort()).id;
    const fresh = await createUser("GRADUATE");
    const blocked = await call(apply, { cookie: fresh.cookie, body: { cohortId } });
    expect(blocked.res.status).toBe(400);
    expect(blocked.json.error.details.missing).toContain("Phone number");

    await completeProfile(gradA);
    sent.length = 0;
    const { res, json } = await call(apply, { cookie: gradA.cookie, body: { cohortId } });
    expect(res.status).toBe(201);
    expect(json.data.status).toBe("SUBMITTED");
    appId = json.data.id;
    expect(sent.map((e) => e.template)).toEqual(["application-received"]);
  });

  it("allows only one active application", async () => {
    const other = await createOpenCohort();
    const { res } = await call(apply, { cookie: gradA.cookie, body: { cohortId: other.id } });
    expect(res.status).toBe(409);
  });

  it("lets admins filter, screen and shortlist with internal notes", async () => {
    const list = await call(adminApps, {
      method: "GET",
      cookie: admin.cookie,
      path: `/?cohortId=${cohortId}&status=SUBMITTED,SCREENING&state=Lagos`,
    });
    expect(list.json.data.map((a: { id: string }) => a.id)).toContain(appId);

    const params = { id: appId };
    await call(adminStatus, {
      cookie: admin.cookie,
      params,
      body: { status: "SCREENING", note: "SECRET-NOTE" },
    });
    sent.length = 0;
    const shortlisted = await call(adminStatus, {
      cookie: admin.cookie,
      params,
      body: { status: "SHORTLISTED" },
    });
    expect(shortlisted.json.data.status).toBe("SHORTLISTED");
    expect(sent.map((e) => e.template)).toEqual(["application-shortlisted"]);

    const illegal = await call(adminStatus, { cookie: admin.cookie, params, body: { status: "PLACED" } });
    expect(illegal.json.error.code).toBe("INVALID_TRANSITION");

    const detail = await call(adminAppDetail, { method: "GET", cookie: admin.cookie, params });
    expect(detail.json.data.notes[0].body).toBe("SECRET-NOTE");

    const audits = await db.auditLog.count({
      where: { entityId: appId, action: "application.status_changed" },
    });
    expect(audits).toBe(2);
  });

  it("shows the graduate a timeline without internal notes", async () => {
    const { json } = await call(myApp, { method: "GET", cookie: gradA.cookie, params: { id: appId } });
    expect(json.data.timeline.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      "SUBMITTED",
      "SCREENING",
      "SHORTLISTED",
    ]);
    expect(JSON.stringify(json)).not.toContain("SECRET-NOTE");
  });

  it("keeps graduates out of each other's applications and admin routes", async () => {
    expect(
      (await call(myApp, { method: "GET", cookie: gradB.cookie, params: { id: appId } })).res.status,
    ).toBe(404);
    expect((await call(withdraw, { cookie: gradB.cookie, params: { id: appId }, body: {} })).res.status).toBe(
      404,
    );
    expect((await call(adminApps, { method: "GET", cookie: gradA.cookie })).res.status).toBe(403);
  });

  it("delivers notifications that only the owner can mark read", async () => {
    const { json } = await call(notifications, {
      method: "GET",
      cookie: gradA.cookie,
      path: "/?unread=true",
    });
    expect(json.meta.unreadCount).toBeGreaterThanOrEqual(3);
    const id = json.data[0].id;
    expect((await call(markRead, { cookie: gradB.cookie, params: { id } })).res.status).toBe(404);
    expect((await call(markRead, { cookie: gradA.cookie, params: { id } })).res.status).toBe(200);
  });

  it("lets the graduate withdraw once", async () => {
    const first = await call(withdraw, {
      cookie: gradA.cookie,
      params: { id: appId },
      body: { reason: "Got a job" },
    });
    expect(first.json.data.status).toBe("WITHDRAWN");
    expect(first.json.data.canWithdraw).toBe(false);
    const again = await call(withdraw, { cookie: gradA.cookie, params: { id: appId }, body: {} });
    expect(again.res.status).toBe(409);
  });

  it("requires a reason to reject, and enforces cohort capacity", async () => {
    const cohort = await createOpenCohort({ capacity: 1 });
    const ids: string[] = [];
    for (const name of ["Chi", "Dayo"]) {
      const g = await createUser("GRADUATE", name);
      await completeProfile(g);
      ids.push((await call(apply, { cookie: g.cookie, body: { cohortId: cohort.id } })).json.data.id);
    }
    const noReason = await call(adminStatus, {
      cookie: admin.cookie,
      params: { id: ids[0] },
      body: { status: "REJECTED" },
    });
    expect(noReason.res.status).toBe(400);

    const bulk = await call(bulkStatus, {
      cookie: admin.cookie,
      body: { status: "SCREENING", applicationIds: [...ids, appId] },
    });
    expect(bulk.json.data).toMatchObject({ succeeded: 2, failed: 1 });

    const ok1 = await call(adminStatus, {
      cookie: admin.cookie,
      params: { id: ids[0] },
      body: { status: "SHORTLISTED" },
    });
    expect(ok1.res.status).toBe(200);
    const full = await call(adminStatus, {
      cookie: admin.cookie,
      params: { id: ids[1] },
      body: { status: "SHORTLISTED" },
    });
    expect(full.res.status).toBe(409);
    expect(full.json.error.message).toMatch(/full/);
  });
});

describe("admin cohorts", () => {
  const day = 24 * 60 * 60 * 1000;
  const at = (d: number) => new Date(Date.now() + d * day).toISOString();
  const body = {
    name: "Cohort Test Lagos",
    applicationOpensAt: at(-1),
    applicationClosesAt: at(10),
    trainingStartsAt: at(11),
    trainingEndsAt: at(40),
    internshipStartsAt: at(41),
    internshipEndsAt: at(130),
    capacity: 50,
  };

  it("validates dates, then creates, opens and closes a cohort", async () => {
    const bad = await call(createCohort, {
      cookie: admin.cookie,
      body: { ...body, trainingStartsAt: at(5) },
    });
    expect(bad.res.status).toBe(400);

    const { json } = await call(createCohort, { cookie: admin.cookie, body });
    expect(json.data.status).toBe("DRAFT");
    const params = { id: json.data.id };

    await call(cohortStatus, { cookie: admin.cookie, params, body: { status: "APPLICATIONS_OPEN" } });
    const open = await call(openCohorts, { method: "GET" });
    expect(open.json.data.map((c: { id: string }) => c.id)).toContain(params.id);

    await call(cohortStatus, { cookie: admin.cookie, params, body: { status: "APPLICATIONS_CLOSED" } });
    const g = await createUser("GRADUATE");
    await completeProfile(g);
    expect((await call(apply, { cookie: g.cookie, body: { cohortId: params.id } })).res.status).toBe(400);

    const illegal = await call(cohortStatus, { cookie: admin.cookie, params, body: { status: "ARCHIVED" } });
    expect(illegal.json.error.code).toBe("INVALID_TRANSITION");
  });
});
