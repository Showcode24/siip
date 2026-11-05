import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as analytics } from "../../app/api/v1/admin/analytics/route";
import { GET as exportApps } from "../../app/api/v1/admin/exports/applications/route";
import { GET as me } from "../../app/api/v1/auth/me/route";
import { GET as daily } from "../../app/api/v1/cron/daily/route";
import { GET as dataExport } from "../../app/api/v1/me/data-export/route";
import { POST as deleteAccount } from "../../app/api/v1/me/delete-account/route";
import { db } from "@/server/db";
import { anonymiseDeletedUsers, runDailyJobs } from "@/server/services/cron.service";
import { completeProfile, createOpenCohort, createUser, type TestUser } from "./factories";
import { call } from "./helpers";

const sent: Array<{ template: string; idempotencyKey: string }> = [];
const keys = new Set<string>();
vi.mock("@/server/email/send", () => ({
  // Mirrors the real idempotency: a key already used is "skipped".
  sendEmail: vi.fn(async (input: { template: string; idempotencyKey: string }) => {
    if (keys.has(input.idempotencyKey)) return "skipped";
    keys.add(input.idempotencyKey);
    sent.push(input);
    return "logged";
  }),
}));

const DAY = 24 * 60 * 60 * 1000;
let admin: TestUser;
let grad: TestUser;
let cohortId: string;

beforeAll(async () => {
  [admin, grad] = await Promise.all([createUser("ADMIN"), createUser("GRADUATE", "Ngozi")]);
  cohortId = (await createOpenCohort({ name: "Analytics Cohort" })).id;
  const graduateId = await completeProfile(grad);
  // A name that would run as a formula in Excel if exported unescaped.
  await db.graduateProfile.update({ where: { id: graduateId }, data: { firstName: "=HYPERLINK(1)" } });
  await db.application.create({ data: { graduateId, cohortId, status: "SCREENING" } });
});

describe("analytics and exports", () => {
  it("reports stages per cohort to admins only", async () => {
    const { json } = await call(analytics, {
      method: "GET",
      cookie: admin.cookie,
      path: `/?cohortId=${cohortId}`,
    });
    expect(json.data.stagesByCohort).toEqual([
      { cohortId, cohortName: "Analytics Cohort", stages: { SCREENING: 1 } },
    ]);
    expect(json.data.rates).toHaveProperty("placementRate");
    expect((await call(analytics, { method: "GET", cookie: grad.cookie })).res.status).toBe(403);
  });

  it("exports applications as safe CSV and audits the export", async () => {
    const { res } = await call(exportApps, {
      method: "GET",
      cookie: admin.cookie,
      path: `/?cohortId=${cohortId}`,
    });
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("application_id");
    expect(text).toContain("'=HYPERLINK(1)");
    expect(await db.auditLog.count({ where: { action: "export.applications", actorId: admin.id } })).toBe(1);
  });
});

describe("daily cron", () => {
  it("rejects calls without the secret", async () => {
    expect((await call(daily, { method: "GET" })).res.status).toBe(401);
  });

  it("closes expired cohorts and does not repeat reminders", async () => {
    const expired = await createOpenCohort();
    await db.cohort.update({
      where: { id: expired.id },
      data: { applicationClosesAt: new Date(Date.now() - DAY) },
    });
    await db.application.updateMany({ where: { cohortId }, data: { status: "IN_TRAINING" } });
    await db.course.create({
      data: {
        cohortId,
        title: "Basics",
        published: true,
        modules: { create: { title: "M1", lessons: { create: { title: "L1" } } } },
      },
    });

    const res = await fetchDaily();
    expect(Object.values(res).every((r) => r.ok)).toBe(true);
    expect((await db.cohort.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe(
      "APPLICATIONS_CLOSED",
    );
    expect(sent.some((e) => e.template === "progress-reminder")).toBe(true);

    const second = await runDailyJobs();
    expect(second.remindGraduates.count).toBe(0);
  });
});

async function fetchDaily() {
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const { NextRequest } = await import("next/server");
  const res = await daily(new NextRequest("http://localhost:3000/api/v1/cron/daily", { headers }), {
    params: Promise.resolve({}),
  });
  const json = await res.json();
  return json.data as Record<string, { ok: boolean; count?: number }>;
}

describe("NDPA", () => {
  it("exports the user's own data without storage ids", async () => {
    const { res, json: body } = await call(dataExport, { method: "GET", cookie: grad.cookie });
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(body.data.email).toBe(grad.email);
    expect(body.data.graduateProfile.hasCv).toBe(true);
    expect(body.data.graduateProfile.cvPublicId).toBeUndefined();
  });

  it("soft-deletes on request and anonymises after the grace period", async () => {
    const wrong = await call(deleteAccount, {
      cookie: grad.cookie,
      body: { password: "nope", confirm: "DELETE" },
    });
    expect(wrong.res.status).toBe(401);

    const done = await call(deleteAccount, {
      cookie: grad.cookie,
      body: { password: "Secret123", confirm: "DELETE" },
    });
    expect(done.json.data.deleted).toBe(true);
    expect((await call(me, { method: "GET", cookie: grad.cookie })).res.status).toBe(401);
    const app = await db.application.findFirstOrThrow({ where: { cohortId, graduate: { userId: grad.id } } });
    expect(app.status).toBe("WITHDRAWN");

    expect(await anonymiseDeletedUsers(new Date())).toBe(0);
    expect(await anonymiseDeletedUsers(new Date(Date.now() + 31 * DAY))).toBeGreaterThanOrEqual(1);
    const user = await db.user.findUniqueOrThrow({
      where: { id: grad.id },
      include: { graduateProfile: true },
    });
    expect(user.email).toBe(`deleted-${grad.id}@deleted.invalid`);
    expect(user.graduateProfile).toMatchObject({ firstName: "Deleted", phone: null, cvPublicId: null });
  });
});
