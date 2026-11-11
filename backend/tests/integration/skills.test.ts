import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as adminDocUrl } from "../../app/api/v1/admin/skill-documents/[id]/url/route";
import { GET as getProfile } from "../../app/api/v1/graduate/profile/route";
import { POST as submit } from "../../app/api/v1/graduate/profile/submit/route";
import { GET as docUrl } from "../../app/api/v1/graduate/skill-documents/[id]/url/route";
import { DELETE as removeDoc } from "../../app/api/v1/graduate/skills/[id]/documents/[documentId]/route";
import { POST as addDoc } from "../../app/api/v1/graduate/skills/[id]/documents/route";
import { POST as signDoc } from "../../app/api/v1/graduate/skills/[id]/documents/sign/route";
import { DELETE as removeSkill, PATCH as patchSkill } from "../../app/api/v1/graduate/skills/[id]/route";
import { GET as listSkills, POST as addSkill } from "../../app/api/v1/graduate/skills/route";
import { db } from "@/server/db";
import { completeProfile, createUser, ensureSkill, graduateIdOf, type TestUser } from "./factories";
import { call } from "./helpers";

vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn(async () => "logged") }));

// Cloudinary is faked; the ownership check on uploaded files is the real one.
vi.mock("@/server/storage/cloudinary", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/storage/cloudinary")>();
  return {
    ...real,
    createSignedUpload: vi.fn((kind: "skillDoc", ownerId: string) => ({
      uploadUrl: "https://upload.test",
      fields: {},
      publicId: `siip/skill-docs/${ownerId}/abc`,
      maxBytes: 5 * 1024 * 1024,
      allowedFormats: real.UPLOAD_KINDS[kind].formats,
    })),
    confirmUpload: vi.fn(async (kind: "skillDoc", ownerId: string, publicId: string) => {
      real.assertOwnedPublicId(kind, ownerId, publicId);
      return { publicId, url: `https://cdn.test/${publicId}`, bytes: 120_000, format: "pdf" };
    }),
    privateDownloadUrl: vi.fn((publicId: string) => `https://signed.test/${publicId}?expires=1`),
    deleteAsset: vi.fn(async () => undefined),
  };
});

let intern: TestUser;
let other: TestUser;
let admin: TestUser;
let designId: string;

beforeAll(async () => {
  [intern, other, admin] = await Promise.all([
    createUser("GRADUATE", "Chidi"),
    createUser("GRADUATE", "Efe"),
    createUser("ADMIN"),
  ]);
  designId = (await ensureSkill("Graphic Design")).id;
  // Complete everything except skills, so only skills and proof block review.
  const graduateId = await completeProfile(intern);
  await db.graduateSkill.deleteMany({ where: { graduateId } });
});

describe("skills with proof", () => {
  let skillId: string;
  let otherSkillId: string;
  let fileDocId: string;

  it("adds skills from the list or as Other, at a claimed level", async () => {
    const listed = await call(addSkill, {
      cookie: intern.cookie,
      body: { skillId: designId, level: "EXPERT", issuingBody: "Coursera", issuedAt: "2025-06-01" },
    });
    expect(listed.res.status).toBe(201);
    expect(listed.json.data).toMatchObject({
      name: "Graphic Design",
      level: "EXPERT",
      status: "PENDING",
      documents: [],
    });
    skillId = listed.json.data.id;

    const again = await call(addSkill, { cookie: intern.cookie, body: { skillId: designId, level: "BEGINNER" } });
    expect(again.res.status).toBe(409);

    const custom = await call(addSkill, {
      cookie: intern.cookie,
      body: { otherName: "Motion Graphics", level: "INTERMEDIATE" },
    });
    expect(custom.res.status).toBe(201);
    expect(custom.json.data).toMatchObject({ name: "Motion Graphics", category: "Other", isOther: true });
    otherSkillId = custom.json.data.id;

    const neither = await call(addSkill, { cookie: intern.cookie, body: { level: "BEGINNER" } });
    expect(neither.res.status).toBe(422);
    const future = await call(addSkill, {
      cookie: intern.cookie,
      body: { otherName: "Translation", level: "BEGINNER", issuedAt: "2999-01-01" },
    });
    expect(future.res.status).toBe(422);
  });

  it("won't submit for review until every skill has a document", async () => {
    const early = await call(submit, { cookie: intern.cookie });
    expect(early.res.status).toBe(400);
    expect(early.json.error.details.skillsWithoutProof).toEqual(["Graphic Design", "Motion Graphics"]);
  });

  it("takes a link or an uploaded file as proof, and only the owner can open it", async () => {
    const badLink = await call(addDoc, {
      cookie: intern.cookie,
      params: { id: otherSkillId },
      body: { kind: "LINK", url: "javascript:alert(1)" },
    });
    expect(badLink.res.status).toBe(422);
    const link = await call(addDoc, {
      cookie: intern.cookie,
      params: { id: otherSkillId },
      body: { kind: "LINK", url: "https://www.coursera.org/verify/ABC123" },
    });
    expect(link.res.status).toBe(201);

    const signed = await call(signDoc, { cookie: intern.cookie, params: { id: skillId } });
    expect(signed.json.data.allowedFormats).toEqual(["pdf", "jpg", "jpeg", "png"]);

    // Someone else's upload can't be attached.
    const otherId = await graduateIdOf(other);
    const stolen = await call(addDoc, {
      cookie: intern.cookie,
      params: { id: skillId },
      body: { kind: "FILE", publicId: `siip/skill-docs/${otherId}/abc`, fileName: "x.pdf" },
    });
    expect(stolen.res.status).toBe(403);

    const file = await call(addDoc, {
      cookie: intern.cookie,
      params: { id: skillId },
      body: { kind: "FILE", publicId: signed.json.data.publicId, fileName: "Certificate.pdf" },
    });
    expect(file.res.status).toBe(201);
    const doc = file.json.data.documents[0];
    expect(doc).toMatchObject({ kind: "FILE", fileName: "Certificate.pdf", format: "pdf", url: null });
    expect(doc).not.toHaveProperty("publicId");
    fileDocId = doc.id;

    const mine = await call(docUrl, { method: "GET", cookie: intern.cookie, params: { id: fileDocId } });
    expect(mine.json.data.url).toContain("https://signed.test/");
    const theirs = await call(docUrl, { method: "GET", cookie: other.cookie, params: { id: fileDocId } });
    expect(theirs.res.status).toBe(404);

    const asAdmin = await call(adminDocUrl, { method: "GET", cookie: admin.cookie, params: { id: fileDocId } });
    expect(asAdmin.res.status).toBe(200);
    expect(await db.auditLog.count({ where: { action: "skill_document.viewed", entityId: fileDocId } })).toBe(1);
  });

  it("submits for review once, then keeps at least one document per skill", async () => {
    const ok = await call(submit, { cookie: intern.cookie });
    expect(ok.res.status).toBe(200);
    expect(ok.json.data.reviewStatus).toBe("SUBMITTED");
    expect((await call(submit, { cookie: intern.cookie })).res.status).toBe(409);

    const profile = await call(getProfile, { method: "GET", cookie: intern.cookie });
    expect(profile.json.data).toMatchObject({ reviewStatus: "SUBMITTED", skillsWithoutProof: [] });

    const lastDoc = await call(removeDoc, {
      method: "DELETE",
      cookie: intern.cookie,
      params: { id: skillId, documentId: fileDocId },
    });
    expect(lastDoc.res.status).toBe(409);
  });

  it("sends a checked skill back to pending when the claim changes", async () => {
    await db.graduateSkill.update({
      where: { id: skillId },
      data: { status: "VERIFIED", verifiedLevel: "INTERMEDIATE", reviewedAt: new Date() },
    });
    const sameLevel = await call(patchSkill, {
      method: "PATCH",
      cookie: intern.cookie,
      params: { id: skillId },
      body: { level: "EXPERT" },
    });
    expect(sameLevel.json.data).toMatchObject({ status: "VERIFIED", verifiedLevel: "INTERMEDIATE" });

    const changed = await call(patchSkill, {
      method: "PATCH",
      cookie: intern.cookie,
      params: { id: skillId },
      body: { level: "ADVANCED" },
    });
    expect(changed.json.data).toMatchObject({ status: "PENDING", verifiedLevel: null, level: "ADVANCED" });
  });

  it("reopens a rejected skill when new proof arrives, and removes skills cleanly", async () => {
    await db.graduateSkill.update({
      where: { id: otherSkillId },
      data: { status: "REJECTED", rejectionReason: "The link doesn't show your name" },
    });
    const more = await call(addDoc, {
      cookie: intern.cookie,
      params: { id: otherSkillId },
      body: { kind: "LINK", url: "https://portfolio.example/chidi" },
    });
    expect(more.json.data).toMatchObject({ status: "PENDING", rejectionReason: null });
    expect(more.json.data.documents).toHaveLength(2);

    const gone = await call(removeSkill, { method: "DELETE", cookie: intern.cookie, params: { id: otherSkillId } });
    expect(gone.res.status).toBe(200);
    expect(await db.skillDocument.count({ where: { graduateSkillId: otherSkillId } })).toBe(0);

    const list = await call(listSkills, { method: "GET", cookie: intern.cookie });
    expect(list.json.data.map((s: { name: string }) => s.name)).toEqual(["Graphic Design"]);
    const notMine = await call(removeSkill, { method: "DELETE", cookie: other.cookie, params: { id: skillId } });
    expect(notMine.res.status).toBe(404);
  });
});
