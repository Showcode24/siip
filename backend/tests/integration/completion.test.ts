import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as issue } from "../../app/api/v1/admin/placements/[id]/certificate/route";
import { POST as complete } from "../../app/api/v1/admin/placements/[id]/complete/route";
import { POST as review } from "../../app/api/v1/admin/placements/[id]/review/route";
import { POST as supervisorCheckIn } from "../../app/api/v1/company/interns/[id]/check-ins/route";
import { POST as evaluate } from "../../app/api/v1/company/interns/[id]/evaluation/route";
import { POST as offer } from "../../app/api/v1/company/interns/[id]/permanent-offer/route";
import { GET as download } from "../../app/api/v1/graduate/certificates/[id]/download/route";
import { GET as myCertificates } from "../../app/api/v1/graduate/certificates/route";
import {
  GET as myCheckIns,
  POST as internCheckIn,
} from "../../app/api/v1/graduate/placement/check-ins/route";
import { GET as verify } from "../../app/api/v1/public/certificates/verify/[code]/route";
import { db } from "@/server/db";
import { completeProfile, createOpenCohort, createUser, type TestUser } from "./factories";
import { call } from "./helpers";

const sent: string[] = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string }) => {
    sent.push(input.template);
    return "logged";
  }),
}));
vi.mock("@/server/storage/cloudinary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/storage/cloudinary")>()),
  uploadBuffer: vi.fn(async (_buf: Buffer, opts: { publicId: string }) => ({
    publicId: opts.publicId,
    url: `https://cdn.test/${opts.publicId}`,
    bytes: 100,
    format: "pdf",
  })),
  privateDownloadUrl: vi.fn((publicId: string) => `https://signed.test/${publicId}`),
}));

const DAY = 24 * 60 * 60 * 1000;
let admin: TestUser;
let owner: TestUser;
let otherSupervisor: TestUser;
let intern: TestUser;
let stranger: TestUser;
let placementId: string;

/** A placement that started 40 days ago (month 2 of 3). */
async function activePlacement() {
  const cohort = await createOpenCohort({ name: "Cohort Lagos 1" });
  const graduateId = await completeProfile(intern);
  await db.graduateProfile.update({
    where: { id: graduateId },
    data: { firstName: "Zainab", lastName: "Musa" },
  });
  const company = await db.company.create({
    data: {
      name: "Acme Media",
      rcNumber: `RC${Date.now() % 10_000_000}`,
      industry: "Media",
      address: "1 Marina",
      state: "Lagos",
      verificationStatus: "VERIFIED",
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: otherSupervisor.id, role: "SUPERVISOR" },
        ],
      },
    },
    include: { members: true },
  });
  const opening = await db.internshipOpening.create({
    data: {
      companyId: company.id,
      title: "Content Intern",
      description: "Create content for our brands every week.",
      slots: 1,
      state: "Lagos",
      workMode: "ONSITE",
      schedule: "FULL_TIME",
      status: "CLOSED",
      createdById: owner.id,
    },
  });
  const app = await db.application.create({ data: { graduateId, cohortId: cohort.id, status: "PLACED" } });
  const match = await db.match.create({
    data: {
      graduateId,
      applicationId: app.id,
      openingId: opening.id,
      score: 90,
      scoreBreakdown: {},
      status: "COMPANY_ACCEPTED",
      proposedById: admin.id,
    },
  });
  const start = new Date(Date.now() - 40 * DAY);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 3);
  const ownerMember = company.members.find((m) => m.role === "OWNER")!;
  const placement = await db.placement.create({
    data: {
      matchId: match.id,
      applicationId: app.id,
      graduateId,
      openingId: opening.id,
      companyId: company.id,
      supervisorId: ownerMember.id,
      startDate: start,
      endDate: end,
    },
  });
  return placement.id;
}

const checkIn = (month: number) => ({
  month,
  progressNote: `Month ${month}: learning a lot every week.`,
  rating: 4,
});
const scores = { punctuality: 5, skill: 4, communication: 4, teamwork: 5, initiative: 4, wouldHire: true };

beforeAll(async () => {
  [admin, owner, otherSupervisor, intern, stranger] = await Promise.all([
    createUser("ADMIN"),
    createUser("COMPANY_MEMBER", "Owner"),
    createUser("COMPANY_MEMBER", "Sup"),
    createUser("GRADUATE", "Zainab"),
    createUser("GRADUATE", "Other"),
  ]);
  placementId = await activePlacement();
});

describe("check-ins", () => {
  it("accepts one check-in per month up to the current month", async () => {
    expect((await call(internCheckIn, { cookie: intern.cookie, body: checkIn(1) })).res.status).toBe(201);
    expect((await call(internCheckIn, { cookie: intern.cookie, body: checkIn(1) })).res.status).toBe(409);
    expect((await call(internCheckIn, { cookie: intern.cookie, body: checkIn(2) })).res.status).toBe(201);
    expect((await call(internCheckIn, { cookie: intern.cookie, body: checkIn(3) })).res.status).toBe(400);
  });

  it("lets only the assigned supervisor or owner check in, and hides their notes from the intern", async () => {
    const params = { id: placementId };
    expect(
      (await call(supervisorCheckIn, { cookie: otherSupervisor.cookie, params, body: checkIn(1) })).res
        .status,
    ).toBe(403);
    expect(
      (await call(supervisorCheckIn, { cookie: owner.cookie, params, body: checkIn(1) })).res.status,
    ).toBe(201);
    const mine = await call(myCheckIns, { method: "GET", cookie: intern.cookie });
    expect(mine.json.data.map((c: { authorType: string }) => c.authorType)).toEqual(["INTERN", "INTERN"]);
  });
});

describe("evaluation, offer and certificate", () => {
  it("only opens the evaluation near the end of the internship", async () => {
    const early = await call(evaluate, { cookie: owner.cookie, params: { id: placementId }, body: scores });
    expect(early.res.status).toBe(400);
  });

  it("records a permanent offer once", async () => {
    const params = { id: placementId };
    const first = await call(offer, { cookie: owner.cookie, params, body: { notes: "Junior content role" } });
    expect(first.json.data.offeredPermanentRole).toBe(true);
    expect((await call(offer, { cookie: owner.cookie, params, body: {} })).res.status).toBe(409);
  });

  it("requires completion, an evaluation and admin approval before issuing", async () => {
    const params = { id: placementId };
    expect((await call(issue, { cookie: admin.cookie, params })).res.status).toBe(409);
    await call(complete, { cookie: admin.cookie, params });
    expect(
      (await call(review, { cookie: admin.cookie, params, body: { approvedForCertificate: true } })).res
        .status,
    ).toBe(409);

    const evaluation = await call(evaluate, { cookie: owner.cookie, params, body: scores });
    expect(evaluation.json.data.overallScore).toBe(4.4);
    expect((await call(evaluate, { cookie: owner.cookie, params, body: scores })).res.status).toBe(409);

    expect((await call(issue, { cookie: admin.cookie, params })).res.status).toBe(409);
    await call(review, {
      cookie: admin.cookie,
      params,
      body: { approvedForCertificate: true, notes: "Strong intern" },
    });
  });

  it("issues the certificate exactly once", async () => {
    const params = { id: placementId };
    sent.length = 0;
    const first = await call(issue, { cookie: admin.cookie, params });
    expect(first.res.status).toBe(201);
    expect(first.json.data.serialNumber).toMatch(/^SIIP-\d{4}-[A-Z2-9]{8}$/);
    const again = await call(issue, { cookie: admin.cookie, params });
    expect(again.json.data.id).toBe(first.json.data.id);
    expect(sent).toEqual(["certificate-issued"]);
    expect(await db.certificate.count({ where: { placementId } })).toBe(1);
  });

  it("lets the graduate download it and anyone verify it", async () => {
    const list = await call(myCertificates, { method: "GET", cookie: intern.cookie });
    const cert = list.json.data[0];
    expect(cert.ready).toBe(true);

    const link = await call(download, { method: "GET", cookie: intern.cookie, params: { id: cert.id } });
    expect(link.json.data.url).toContain("signed.test");
    expect(
      (await call(download, { method: "GET", cookie: stranger.cookie, params: { id: cert.id } })).res.status,
    ).toBe(404);

    const { json } = await call(verify, {
      method: "GET",
      params: { code: cert.verificationCode.toLowerCase() },
    });
    expect(json.data).toMatchObject({
      valid: true,
      graduateName: "Zainab Musa",
      cohortName: "Cohort Lagos 1",
      companyName: "Acme Media",
    });
    expect(JSON.stringify(json)).not.toMatch(/@|\+234/);
    expect(
      (await call(verify, { method: "GET", params: { code: `NOPE-${randomUUID().slice(0, 4)}` } })).res
        .status,
    ).toBe(404);
  });
});
