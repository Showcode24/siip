import type { z } from "zod";
import type { OpeningStatus } from "@siip/shared/enums";
import type {
  createOpeningSchema,
  registerCompanySchema,
  updateCompanySchema,
  updateOpeningSchema,
} from "@siip/shared/validators/company";
import { rcNumber } from "@siip/shared/validators/company";
import type { checkInSchema, evaluationSchema } from "@siip/shared/validators/internship";
import { ApiError } from "@/client/api/http";
import type { Company, CompanyMatch } from "@/client/api/types";
import { audit, db, graduateById, newId, notify, openingById, userById, type DbCompany } from "./db";
import { internshipMonth } from "./graduate";
import {
  badRequest,
  conflict,
  isoNow,
  limitedGraduate,
  notFound,
  presentOpening,
  presentPlacement,
  requireMember,
  requireUser,
  transition,
} from "./logic";

const present = (c: DbCompany, myRole?: Company["myRole"]): Company => ({
  ...c,
  ...(myRole ? { myRole } : {}),
});

export function register(input: z.input<typeof registerCompanySchema>) {
  const user = requireUser();
  if (db.members.some((m) => m.userId === user.id)) throw conflict("You already belong to a company");
  const rc = rcNumber.parse(input.rcNumber);
  if (db.companies.some((c) => c.rcNumber === rc))
    throw conflict("A record with these details already exists");
  const c: DbCompany = {
    id: newId("cmp"),
    name: input.name,
    rcNumber: rc,
    industry: input.industry,
    description: input.description ?? null,
    address: input.address,
    state: input.state,
    website: input.website ?? null,
    logoUrl: null,
    verificationStatus: "PENDING",
    verifiedAt: null,
    statusReason: null,
    createdAt: isoNow(),
  };
  db.companies.push(c);
  db.members.push({
    id: newId("mbr"),
    companyId: c.id,
    userId: user.id,
    role: "OWNER",
    jobTitle: input.jobTitle ?? null,
    createdAt: isoNow(),
  });
  audit(user.id, "company.registered", "Company", c.id);
  return present(c, "OWNER");
}

export function getProfile() {
  const { company, member } = requireMember();
  return present(company, member.role);
}

export function updateProfile(input: z.input<typeof updateCompanySchema>) {
  const { company, user } = requireMember({ ownerOnly: true });
  const rc = input.rcNumber ? rcNumber.parse(input.rcNumber) : undefined;
  if (
    ((input.name && input.name !== company.name) || (rc && rc !== company.rcNumber)) &&
    ["VERIFIED", "SUSPENDED"].includes(company.verificationStatus)
  ) {
    throw conflict("Contact SIIP to change the name or RC number of a verified company");
  }
  Object.assign(company, input, rc ? { rcNumber: rc } : {});
  audit(user.id, "company.updated", "Company", company.id);
  return present(company, "OWNER");
}

export function resubmit() {
  const { company } = requireMember({ ownerOnly: true });
  if (company.verificationStatus !== "REJECTED")
    throw new ApiError(
      "INVALID_TRANSITION",
      `Company cannot move from ${company.verificationStatus} to PENDING`,
      409,
    );
  company.verificationStatus = "PENDING";
  company.statusReason = null;
  return present(company, "OWNER");
}

export function listMembers() {
  const { company } = requireMember();
  return db.members
    .filter((m) => m.companyId === company.id)
    .map((m) => {
      const u = userById(m.userId)!;
      return {
        id: m.id,
        role: m.role,
        jobTitle: m.jobTitle,
        createdAt: m.createdAt,
        user: { name: u.name, email: u.email },
        _count: { supervisedPlacements: db.placements.filter((p) => p.supervisorId === m.id).length },
      };
    });
}

export function removeMember(id: string) {
  const { company } = requireMember({ ownerOnly: true });
  const m = db.members.find((x) => x.id === id && x.companyId === company.id);
  if (!m) throw notFound("Member");
  if (m.role === "OWNER") throw conflict("The company owner cannot be removed");
  db.members = db.members.filter((x) => x.id !== id);
  return { id };
}

export function listInvitations() {
  const { company } = requireMember({ ownerOnly: true });
  return db.invitations
    .filter((i) => i.companyId === company.id && !i.acceptedAt && !i.revokedAt && i.expiresAt > isoNow())
    .map(({ id, email, role, expiresAt, createdAt }) => ({ id, email, role, expiresAt, createdAt }));
}

export function invite(email: string) {
  const { company } = requireMember({ ownerOnly: true });
  const lower = email.toLowerCase();
  if (db.members.some((m) => m.companyId === company.id && userById(m.userId)?.email === lower))
    throw conflict("This person is already a member of your company");
  db.invitations
    .filter((i) => i.companyId === company.id && i.email === lower && !i.acceptedAt)
    .forEach((i) => (i.revokedAt = isoNow()));
  const inv = {
    id: newId("inv"),
    companyId: company.id,
    email: lower,
    role: "SUPERVISOR" as const,
    token: newId("tok"),
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    createdAt: isoNow(),
    acceptedAt: null,
    revokedAt: null,
  };
  db.invitations.push(inv);
  return { id: inv.id, email: inv.email, role: inv.role, expiresAt: inv.expiresAt, createdAt: inv.createdAt };
}

export function revokeInvitation(id: string) {
  const { company } = requireMember({ ownerOnly: true });
  const inv = db.invitations.find(
    (i) => i.id === id && i.companyId === company.id && !i.acceptedAt && !i.revokedAt,
  );
  if (!inv) throw notFound("Invitation");
  inv.revokedAt = isoNow();
  return { id };
}

export function acceptInvitation(token: string) {
  const user = requireUser();
  const inv = db.invitations.find((i) => i.token === token && !i.acceptedAt && !i.revokedAt);
  if (!inv) throw badRequest("This invitation is invalid or has expired");
  if (inv.email !== user.email)
    throw new ApiError("FORBIDDEN", "This invitation was sent to a different email address", 403);
  inv.acceptedAt = isoNow();
  const m = {
    id: newId("mbr"),
    companyId: inv.companyId,
    userId: user.id,
    role: inv.role,
    jobTitle: null,
    createdAt: isoNow(),
  };
  db.members.push(m);
  return { id: m.id };
}

// ─── Openings ─────────────────────────────────────────────────────────────────

const myOpening = (id: string) => {
  const { company } = requireMember();
  const o = db.openings.find((x) => x.id === id && x.companyId === company.id);
  if (!o) throw notFound("Opening");
  return o;
};

export function listOpenings(status?: OpeningStatus) {
  const { company } = requireMember();
  return db.openings
    .filter((o) => o.companyId === company.id && (!status || o.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => presentOpening(o));
}

export const getOpening = (id: string) => presentOpening(myOpening(id));

export function createOpening(input: z.input<typeof createOpeningSchema>) {
  const { company, user } = requireMember({ ownerOnly: true });
  const o = {
    id: newId("opn"),
    companyId: company.id,
    cohortId: input.cohortId ?? null,
    title: input.title,
    department: input.department ?? null,
    description: input.description,
    slots: input.slots,
    preferredDisciplines: input.preferredDisciplines ?? [],
    state: input.state,
    location: input.location ?? null,
    workMode: input.workMode,
    schedule: input.schedule,
    openToNysc: input.openToNysc ?? true,
    status: "DRAFT" as const,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    skills: input.skills.map((s) => ({
      skillId: s.skillId,
      minLevel: s.minLevel ?? null,
      required: s.required ?? true,
    })),
  };
  db.openings.push(o);
  audit(user.id, "opening.created", "InternshipOpening", o.id);
  return presentOpening(o);
}

export function updateOpening(id: string, input: z.input<typeof updateOpeningSchema>) {
  requireMember({ ownerOnly: true });
  const o = myOpening(id);
  const { skills, ...rest } = input;
  Object.assign(o, rest, { updatedAt: isoNow() });
  if (skills)
    o.skills = skills.map((s) => ({
      skillId: s.skillId,
      minLevel: s.minLevel ?? null,
      required: s.required ?? true,
    }));
  return presentOpening(o);
}

export function setOpeningStatus(id: string, status: OpeningStatus) {
  const { company } = requireMember({ ownerOnly: true });
  const o = myOpening(id);
  if (
    o.status === status ||
    (o.status === "OPEN" && status === "DRAFT") ||
    (o.status === "CLOSED" && status === "DRAFT")
  )
    throw new ApiError("INVALID_TRANSITION", `Opening cannot move from ${o.status} to ${status}`, 409);
  if (status === "OPEN" && company.verificationStatus !== "VERIFIED")
    throw new ApiError("FORBIDDEN", "Your company must be verified before openings can be published", 403);
  o.status = status;
  return presentOpening(o);
}

// ─── Matches ──────────────────────────────────────────────────────────────────

function presentMatch(matchId: string): CompanyMatch {
  const { company } = requireMember();
  const mt = db.matches.find((x) => x.id === matchId && openingById(x.openingId)?.companyId === company.id);
  if (!mt) throw notFound("Match");
  const g = graduateById(mt.graduateId)!;
  const accepted = mt.status === "COMPANY_ACCEPTED";
  return {
    id: mt.id,
    status: mt.status,
    score: mt.score,
    scoreBreakdown: mt.scoreBreakdown,
    createdAt: mt.createdAt,
    decidedAt: mt.decidedAt,
    decisionReason: mt.decisionReason,
    opening: { id: mt.openingId, title: openingById(mt.openingId)!.title },
    // Contact details only once the company has accepted.
    graduate: {
      ...limitedGraduate(g),
      ...(accepted
        ? { phone: g.phone, email: userById(g.userId)!.email, hasCv: Boolean(g.cvUploadedAt) }
        : {}),
    },
  };
}

export function listMatches() {
  const { company } = requireMember();
  return db.matches
    .filter((x) => openingById(x.openingId)?.companyId === company.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((x) => presentMatch(x.id));
}

export const getMatch = (id: string) => presentMatch(id);

export function acceptMatch(id: string, input: { startDate?: string; supervisorId?: string }) {
  const { company, member, user } = requireMember({ ownerOnly: true });
  presentMatch(id);
  const mt = db.matches.find((x) => x.id === id)!;
  if (mt.status !== "PROPOSED")
    throw new ApiError("INVALID_TRANSITION", `Match cannot move from ${mt.status} to COMPANY_ACCEPTED`, 409);
  if (company.verificationStatus !== "VERIFIED")
    throw new ApiError("FORBIDDEN", "Your company must be verified to accept interns", 403);
  const o = openingById(mt.openingId)!;
  const filled = db.placements.filter((p) => p.openingId === o.id && p.status !== "TERMINATED").length;
  if (filled >= o.slots) throw conflict("All slots for this opening are filled");
  const start = input.startDate ? new Date(input.startDate) : new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 3);
  mt.status = "COMPANY_ACCEPTED";
  mt.decidedAt = isoNow();
  const app = db.applications.find((a) => a.id === mt.applicationId)!;
  const p = {
    id: newId("plc"),
    matchId: mt.id,
    applicationId: app.id,
    graduateId: mt.graduateId,
    openingId: o.id,
    companyId: company.id,
    supervisorId: input.supervisorId ?? member.id,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    status: "ACTIVE" as const,
    endedAt: null,
    endReason: null,
    offeredPermanentRole: false,
    permanentOfferDate: null,
    createdAt: isoNow(),
  };
  db.placements.push(p);
  transition(app, "PLACED", "SYSTEM", user.id);
  audit(user.id, "match.accepted", "Match", mt.id, { status: "PROPOSED" }, { status: "COMPANY_ACCEPTED" });
  if (filled + 1 >= o.slots) {
    o.status = "CLOSED";
    db.matches
      .filter((x) => x.openingId === o.id && x.status === "PROPOSED")
      .forEach((x) => {
        x.status = "WITHDRAWN";
        x.decidedAt = isoNow();
        transition(
          db.applications.find((a) => a.id === x.applicationId)!,
          "QUALIFIED",
          "SYSTEM",
          user.id,
        );
      });
  }
  return presentPlacement(p);
}

export function rejectMatch(id: string, reason: string) {
  const { user } = requireMember({ ownerOnly: true });
  presentMatch(id);
  const mt = db.matches.find((x) => x.id === id)!;
  if (mt.status !== "PROPOSED")
    throw new ApiError("INVALID_TRANSITION", `Match cannot move from ${mt.status} to COMPANY_REJECTED`, 409);
  Object.assign(mt, { status: "COMPANY_REJECTED", decidedAt: isoNow(), decisionReason: reason });
  transition(
    db.applications.find((a) => a.id === mt.applicationId)!,
    "QUALIFIED",
    "SYSTEM",
    user.id,
  );
  return { id };
}

// ─── Interns ──────────────────────────────────────────────────────────────────

const myPlacement = (id: string) => {
  const { company } = requireMember();
  const p = db.placements.find((x) => x.id === id && x.companyId === company.id);
  if (!p) throw notFound("Intern");
  return p;
};

/** The owner, or this intern's assigned supervisor. */
const supervised = (id: string) => {
  const { member } = requireMember();
  const p = myPlacement(id);
  if (member.role !== "OWNER" && p.supervisorId !== member.id)
    throw new ApiError("FORBIDDEN", "Only this intern's supervisor or the company owner can do this", 403);
  return p;
};

export function listInterns() {
  const { company } = requireMember();
  return db.placements
    .filter((p) => p.companyId === company.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((p) => presentPlacement(p, { contact: true }));
}
export const getIntern = (id: string) => presentPlacement(myPlacement(id), { contact: true });

export function assignSupervisor(id: string, supervisorId: string) {
  const { company } = requireMember({ ownerOnly: true });
  const p = myPlacement(id);
  if (!db.members.some((m) => m.id === supervisorId && m.companyId === company.id))
    throw badRequest("The supervisor must be a member of your company");
  p.supervisorId = supervisorId;
  return presentPlacement(p, { contact: true });
}

export function listInternCheckIns(id: string) {
  const p = myPlacement(id);
  return db.checkIns
    .filter((c) => c.placementId === p.id)
    .sort((a, b) => a.month - b.month || a.authorType.localeCompare(b.authorType))
    .map(({ placementId: _p, ...c }) => c);
}

export function submitCheckIn(id: string, input: z.input<typeof checkInSchema>) {
  const p = supervised(id);
  if (p.status !== "ACTIVE") throw conflict("Check-ins are only for active internships");
  const current = internshipMonth(p.startDate);
  if (input.month > current) throw badRequest(`You can submit check-ins up to month ${current}`);
  if (
    db.checkIns.some(
      (c) => c.placementId === p.id && c.authorType === "SUPERVISOR" && c.month === input.month,
    )
  )
    throw conflict(`The month ${input.month} check-in has already been submitted`);
  const c = {
    id: newId("chk"),
    placementId: p.id,
    authorType: "SUPERVISOR" as const,
    month: input.month,
    progressNote: input.progressNote,
    challenges: input.challenges ?? null,
    rating: input.rating ?? null,
    createdAt: isoNow(),
  };
  db.checkIns.push(c);
  const { placementId: _p, ...rest } = c;
  return rest;
}

export function getEvaluation(id: string) {
  const p = myPlacement(id);
  return db.evaluations.find((e) => e.placementId === p.id) ?? null;
}

export function submitEvaluation(id: string, input: z.input<typeof evaluationSchema>) {
  const { user } = requireMember();
  const p = supervised(id);
  const opens = new Date(new Date(p.endDate).getTime() - 14 * 86_400_000);
  if (!(p.status === "COMPLETED" || (p.status === "ACTIVE" && new Date() >= opens)))
    throw badRequest(`Evaluations open on ${opens.toISOString().slice(0, 10)}`);
  if (db.evaluations.some((e) => e.placementId === p.id))
    throw conflict("This intern has already been evaluated");
  const areas = [input.punctuality, input.skill, input.communication, input.teamwork, input.initiative];
  const e = {
    id: newId("evl"),
    placementId: p.id,
    ...input,
    comments: input.comments ?? null,
    overallScore: Math.round((areas.reduce((a, b) => a + b, 0) / 5) * 100) / 100,
    createdAt: isoNow(),
  };
  db.evaluations.push(e);
  audit(user.id, "evaluation.submitted", "Placement", p.id, null, { overallScore: e.overallScore });
  return e;
}

export function recordOffer(id: string, notes?: string) {
  const { user } = requireMember({ ownerOnly: true });
  const p = myPlacement(id);
  if (p.status === "TERMINATED") throw conflict("This internship was ended early");
  if (p.offeredPermanentRole) throw conflict("A permanent offer is already recorded");
  Object.assign(p, { offeredPermanentRole: true, permanentOfferDate: isoNow() });
  notify(
    graduateById(p.graduateId)!.userId,
    "placement.permanent_offer",
    "Permanent job offer",
    "Your host company has recorded a permanent job offer for you. Congratulations!",
  );
  audit(user.id, "placement.permanent_offer_recorded", "Placement", p.id, null, { notes: notes ?? null });
  return presentPlacement(p, { contact: true });
}
