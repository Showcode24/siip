import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as companyStatus } from "../../app/api/v1/admin/companies/[id]/status/route";
import { GET as adminCompanies } from "../../app/api/v1/admin/companies/route";
import { POST as acceptInvite } from "../../app/api/v1/company/invitations/accept/route";
import { POST as invite } from "../../app/api/v1/company/invitations/route";
import { DELETE as removeMember } from "../../app/api/v1/company/members/[id]/route";
import { GET as members } from "../../app/api/v1/company/members/route";
import { GET as getOpening, PATCH as patchOpening } from "../../app/api/v1/company/openings/[id]/route";
import { POST as openingStatus } from "../../app/api/v1/company/openings/[id]/status/route";
import { GET as listOpenings, POST as createOpening } from "../../app/api/v1/company/openings/route";
import { PATCH as patchProfile } from "../../app/api/v1/company/profile/route";
import { POST as register } from "../../app/api/v1/company/register/route";
import { POST as resubmit } from "../../app/api/v1/company/resubmit/route";
import { db } from "@/server/db";
import { createUser, ensureSkill, type TestUser } from "./factories";
import { call } from "./helpers";

const sent: Array<{ template: string; to: string; props: Record<string, string> }> = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string; to: string; props: Record<string, string> }) => {
    sent.push(input);
    return "logged";
  }),
}));

let admin: TestUser;
let ownerA: TestUser;
let ownerB: TestUser;
let supervisor: TestUser;
let companyA: string;
let companyB: string;
let skillId: string;

const companyBody = (name: string, rc: string) => ({
  name,
  country: "NG",
  city: "Lagos",
  timeZone: "Africa/Lagos",
  rcNumber: rc,
  industry: "Media",
  address: "12 Allen Avenue, Ikeja",
  state: "Lagos",
  website: "https://example.ng",
});

const openingBody = () => ({
  title: "Social Media Intern",
  description: "Help run our social media pages and create weekly content.",
  slots: 2,
  country: "NG",
  city: "Lagos",
  state: "Lagos",
  workMode: "HYBRID",
  schedule: "FULL_TIME",
  skills: [{ skillId, minLevel: "BEGINNER" }],
});

beforeAll(async () => {
  [admin, ownerA, ownerB, supervisor] = await Promise.all([
    createUser("ADMIN"),
    createUser("COMPANY_MEMBER", "Tola"),
    createUser("COMPANY_MEMBER", "Sani"),
    createUser("COMPANY_MEMBER", "Ife"),
  ]);
  skillId = (await ensureSkill("Social Media Management")).id;
});

describe("company registration and verification", () => {
  it("registers a company as PENDING with the user as OWNER", async () => {
    const { res, json } = await call(register, {
      cookie: ownerA.cookie,
      body: companyBody("Acme Media", "rc 123456"),
    });
    expect(res.status).toBe(201);
    expect(json.data).toMatchObject({ rcNumber: "RC123456", verificationStatus: "PENDING" });
    companyA = json.data.id;

    expect(
      (await call(register, { cookie: ownerA.cookie, body: companyBody("Again", "RC999") })).res.status,
    ).toBe(409);
    const dupRc = await call(register, { cookie: ownerB.cookie, body: companyBody("Copycat", "RC123456") });
    expect(dupRc.res.status).toBe(409);
    const graduate = await createUser("GRADUATE");
    expect(
      (await call(register, { cookie: graduate.cookie, body: companyBody("X", "RC111") })).res.status,
    ).toBe(403);

    companyB = (await call(register, { cookie: ownerB.cookie, body: companyBody("Beta Ltd", "BN7654321") }))
      .json.data.id;
  });

  it("registers companies outside Nigeria with their own registration number", async () => {
    const ukOwner = await createUser("COMPANY_MEMBER", "Amelia");
    const uk = {
      name: "Thames Studio",
      country: "GB",
      city: "London",
      timeZone: "Europe/London",
      industry: "Design",
      address: "10 Shoreditch High Street",
    };

    const noNumber = await call(register, { cookie: ukOwner.cookie, body: uk });
    expect(noNumber.res.status).toBe(422);
    expect(JSON.stringify(noNumber.json.error.details)).toContain("businessRegNumber");

    const badZone = await call(register, {
      cookie: ukOwner.cookie,
      body: { ...uk, businessRegNumber: "12345678", timeZone: "Mars/Olympus" },
    });
    expect(badZone.res.status).toBe(422);

    const ok = await call(register, {
      cookie: ukOwner.cookie,
      // A CAC number and Nigerian state sent by mistake are dropped for a UK company.
      body: { ...uk, businessRegNumber: "12345678", rcNumber: "RC555", state: "Lagos" },
    });
    expect(ok.res.status).toBe(201);
    expect(ok.json.data).toMatchObject({
      country: "GB",
      city: "London",
      timeZone: "Europe/London",
      businessRegNumber: "12345678",
      rcNumber: null,
      state: null,
    });

    const ngOwner = await createUser("COMPANY_MEMBER", "Ade");
    const noCac = await call(register, {
      cookie: ngOwner.cookie,
      body: { ...companyBody("No CAC Ltd", "RC1"), rcNumber: undefined },
    });
    expect(noCac.res.status).toBe(422);
    expect(JSON.stringify(noCac.json.error.details)).toContain("rcNumber");
  });

  it("needs a place for on-site and hybrid openings but not for remote ones", async () => {
    const placeless = { ...openingBody(), state: undefined, city: undefined, country: undefined };
    const onsite = await call(createOpening, { cookie: ownerB.cookie, body: { ...placeless, workMode: "ONSITE" } });
    expect(onsite.res.status).toBe(422);
    expect(JSON.stringify(onsite.json.error.details)).toContain("city");

    const remote = await call(createOpening, {
      cookie: ownerB.cookie,
      body: { ...openingBody(), workMode: "REMOTE" },
    });
    expect(remote.res.status).toBe(201);
    expect(remote.json.data).toMatchObject({ workMode: "REMOTE", country: null, city: null, state: null });

    // Turning a remote role on-site without saying where is refused.
    const toOnsite = await call(patchOpening, {
      method: "PATCH",
      cookie: ownerB.cookie,
      params: { id: remote.json.data.id },
      body: { workMode: "ONSITE" },
    });
    expect(toOnsite.res.status).toBe(422);
  });

  it("drafts openings while pending but only publishes once verified", async () => {
    const created = await call(createOpening, { cookie: ownerA.cookie, body: openingBody() });
    expect(created.json.data.status).toBe("DRAFT");
    const params = { id: created.json.data.id };
    const early = await call(openingStatus, { cookie: ownerA.cookie, params, body: { status: "OPEN" } });
    expect(early.res.status).toBe(403);

    sent.length = 0;
    const verified = await call(companyStatus, {
      cookie: admin.cookie,
      params: { id: companyA },
      body: { status: "VERIFIED" },
    });
    expect(verified.json.data.verificationStatus).toBe("VERIFIED");
    expect(sent.map((e) => e.template)).toEqual(["company-verified"]);

    const opened = await call(openingStatus, { cookie: ownerA.cookie, params, body: { status: "OPEN" } });
    expect(opened.json.data.status).toBe("OPEN");
    const moveCountry = await call(patchProfile, {
      method: "PATCH",
      cookie: ownerA.cookie,
      body: { country: "GH", businessRegNumber: "CS123456789" },
    });
    expect(moveCountry.res.status).toBe(409);
    const patched = await call(patchOpening, {
      method: "PATCH",
      cookie: ownerA.cookie,
      params,
      body: { slots: 3 },
    });
    expect(patched.json.data.slots).toBe(3);
  });

  it("locks the verified identity but allows other edits", async () => {
    const rename = await call(patchProfile, {
      method: "PATCH",
      cookie: ownerA.cookie,
      body: { name: "New Name" },
    });
    expect(rename.res.status).toBe(409);
    const industry = await call(patchProfile, {
      method: "PATCH",
      cookie: ownerA.cookie,
      body: { industry: "Advertising" },
    });
    expect(industry.json.data.industry).toBe("Advertising");
  });

  it("requires a reason to reject, and lets a rejected company resubmit", async () => {
    const params = { id: companyB };
    expect(
      (await call(companyStatus, { cookie: admin.cookie, params, body: { status: "REJECTED" } })).res.status,
    ).toBe(400);
    await call(companyStatus, {
      cookie: admin.cookie,
      params,
      body: { status: "REJECTED", reason: "RC number not found" },
    });
    const again = await call(resubmit, { cookie: ownerB.cookie });
    expect(again.json.data.verificationStatus).toBe("PENDING");

    const list = await call(adminCompanies, {
      method: "GET",
      cookie: admin.cookie,
      path: "/?status=PENDING&q=beta",
    });
    expect(list.json.data.map((c: { id: string }) => c.id)).toEqual([companyB]);
  });
});

describe("supervisors", () => {
  it("invites a supervisor who joins with the invited email only", async () => {
    sent.length = 0;
    const created = await call(invite, { cookie: ownerA.cookie, body: { email: supervisor.email } });
    expect(created.res.status).toBe(201);
    const token = new URL(sent[0].props.acceptUrl).searchParams.get("token")!;

    const stranger = await createUser("COMPANY_MEMBER");
    expect((await call(acceptInvite, { cookie: stranger.cookie, body: { token } })).res.status).toBe(403);

    const joined = await call(acceptInvite, { cookie: supervisor.cookie, body: { token } });
    expect(joined.json.data).toMatchObject({ role: "SUPERVISOR", company: { id: companyA } });
    expect((await call(acceptInvite, { cookie: supervisor.cookie, body: { token } })).res.status).toBe(400);
  });

  it("lets supervisors read openings but not manage them", async () => {
    expect((await call(listOpenings, { method: "GET", cookie: supervisor.cookie })).json.data).toHaveLength(
      1,
    );
    expect((await call(createOpening, { cookie: supervisor.cookie, body: openingBody() })).res.status).toBe(
      403,
    );
    expect(
      (await call(invite, { cookie: supervisor.cookie, body: { email: "x@example.test" } })).res.status,
    ).toBe(403);
  });

  it("keeps companies out of each other's data", async () => {
    const opening = await db.internshipOpening.findFirstOrThrow({ where: { companyId: companyA } });
    expect(
      (await call(getOpening, { method: "GET", cookie: ownerB.cookie, params: { id: opening.id } })).res
        .status,
    ).toBe(404);
    const supMember = await db.companyMember.findFirstOrThrow({
      where: { companyId: companyA, role: "SUPERVISOR" },
    });
    expect(
      (await call(removeMember, { method: "DELETE", cookie: ownerB.cookie, params: { id: supMember.id } }))
        .res.status,
    ).toBe(404);
    const bMembers = await call(members, { method: "GET", cookie: ownerB.cookie });
    expect(bMembers.json.data).toHaveLength(1);
  });

  it("lets the owner remove a supervisor but not themselves", async () => {
    const owner = await db.companyMember.findFirstOrThrow({ where: { companyId: companyA, role: "OWNER" } });
    expect(
      (await call(removeMember, { method: "DELETE", cookie: ownerA.cookie, params: { id: owner.id } })).res
        .status,
    ).toBe(409);
    const sup = await db.companyMember.findFirstOrThrow({
      where: { companyId: companyA, role: "SUPERVISOR" },
    });
    expect(
      (await call(removeMember, { method: "DELETE", cookie: ownerA.cookie, params: { id: sup.id } })).res
        .status,
    ).toBe(200);
  });
});

describe("suspension", () => {
  it("closes open openings when a company is suspended", async () => {
    await call(companyStatus, {
      cookie: admin.cookie,
      params: { id: companyA },
      body: { status: "SUSPENDED", reason: "Complaint under review" },
    });
    const open = await db.internshipOpening.count({ where: { companyId: companyA, status: "OPEN" } });
    expect(open).toBe(0);
    const audit = await db.auditLog.findFirst({
      where: { entityId: companyA, action: "company.status_changed" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.after).toEqual({ verificationStatus: "SUSPENDED" });
  });
});
