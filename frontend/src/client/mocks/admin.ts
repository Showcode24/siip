import type { z } from "zod";
import type {
  ApplicationStatus,
  CohortStatus,
  CompanyVerificationStatus,
  OpeningStatus,
} from "@siip/shared/enums";
import type { adminApplicationListQuery, changeStatusSchema } from "@siip/shared/validators/application";
import {
  cohortDateProblem,
  type createCohortSchema,
  type updateCohortSchema,
} from "@siip/shared/validators/cohort";
import { ApiError } from "@/client/api/http";
import type { AdminApplicationDetail, AdminCohort, AdminPlacement, Analytics } from "@/client/api/types";
import { toCsv } from "@/lib/csv";
import {
  audit,
  bestFinal,
  cohortById,
  companyById,
  db,
  graduateById,
  newId,
  notify,
  openingById,
  scoreFor,
  skillName,
  verifiedSkills,
  userById,
  type DbCohort,
} from "./db";
import {
  adminRow,
  badRequest,
  conflict,
  isoNow,
  nextStates,
  notFound,
  presentOpening,
  presentPlacement,
  requireAdmin,
  transition,
  presentSkill,
} from "./logic";

// ─── Cohorts ──────────────────────────────────────────────────────────────────

const COHORT_FLOW: Record<CohortStatus, CohortStatus[]> = {
  DRAFT: ["APPLICATIONS_OPEN"],
  APPLICATIONS_OPEN: ["APPLICATIONS_CLOSED"],
  APPLICATIONS_CLOSED: ["APPLICATIONS_OPEN", "IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};
export const cohortNext = (s: CohortStatus) => COHORT_FLOW[s];

function presentCohort(c: DbCohort): AdminCohort {
  const apps = db.applications.filter((a) => a.cohortId === c.id);
  const counts: Partial<Record<ApplicationStatus, number>> = {};
  apps.forEach((a) => (counts[a.status] = (counts[a.status] ?? 0) + 1));
  return { ...c, _count: { applications: apps.length }, applicationCounts: counts };
}
const cohort = (id: string) => {
  const c = cohortById(id);
  if (!c) throw notFound("Cohort");
  return c;
};

export function listCohorts() {
  requireAdmin();
  return [...db.cohorts]
    .sort((a, b) => b.applicationOpensAt.localeCompare(a.applicationOpensAt))
    .map(presentCohort);
}
export function getCohort(id: string) {
  requireAdmin();
  return presentCohort(cohort(id));
}
export function createCohort(input: z.input<typeof createCohortSchema>) {
  const admin = requireAdmin();
  const dates = Object.fromEntries(
    [
      "applicationOpensAt",
      "applicationClosesAt",
      "trainingStartsAt",
      "trainingEndsAt",
      "internshipStartsAt",
      "internshipEndsAt",
    ].map((k) => [k, new Date(input[k as keyof typeof input] as string)]),
  ) as Parameters<typeof cohortDateProblem>[0];
  const problem = cohortDateProblem(dates);
  if (problem) throw badRequest(problem);
  const c: DbCohort = {
    id: newId("coh"),
    name: input.name,
    slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: input.description ?? null,
    capacity: input.capacity,
    status: "DRAFT",
    createdAt: isoNow(),
    ...(Object.fromEntries(Object.entries(dates).map(([k, v]) => [k, v.toISOString()])) as Pick<
      DbCohort,
      | "applicationOpensAt"
      | "applicationClosesAt"
      | "trainingStartsAt"
      | "trainingEndsAt"
      | "internshipStartsAt"
      | "internshipEndsAt"
    >),
  };
  db.cohorts.push(c);
  audit(admin.id, "cohort.created", "Cohort", c.id, null, { name: c.name });
  return presentCohort(c);
}
export function updateCohort(id: string, input: z.input<typeof updateCohortSchema>) {
  const admin = requireAdmin();
  const c = cohort(id);
  const next = {
    ...c,
    ...Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
    ),
  } as DbCohort;
  const problem = cohortDateProblem(
    Object.fromEntries(
      [
        "applicationOpensAt",
        "applicationClosesAt",
        "trainingStartsAt",
        "trainingEndsAt",
        "internshipStartsAt",
        "internshipEndsAt",
      ].map((k) => [k, new Date(next[k as keyof DbCohort] as string)]),
    ) as Parameters<typeof cohortDateProblem>[0],
  );
  if (problem) throw badRequest(problem);
  Object.assign(c, next);
  audit(admin.id, "cohort.updated", "Cohort", id);
  return presentCohort(c);
}
export function setCohortStatus(id: string, status: CohortStatus) {
  const admin = requireAdmin();
  const c = cohort(id);
  if (!COHORT_FLOW[c.status].includes(status))
    throw new ApiError("INVALID_TRANSITION", `Cohort cannot move from ${c.status} to ${status}`, 409);
  if (status === "APPLICATIONS_OPEN" && c.applicationClosesAt <= isoNow())
    throw badRequest("The application window has ended. Move the closing date first.");
  audit(admin.id, "cohort.status_changed", "Cohort", id, { status: c.status }, { status });
  c.status = status;
  return presentCohort(c);
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function listApplications(q: Partial<z.input<typeof adminApplicationListQuery>>) {
  requireAdmin();
  const statuses = q.status ? (Array.isArray(q.status) ? q.status : [q.status]) : undefined;
  return db.applications
    .filter((a) => {
      const g = graduateById(a.graduateId)!;
      return (
        (!q.cohortId || a.cohortId === q.cohortId) &&
        (!statuses?.length || statuses.includes(a.status)) &&
        (!q.state || g.stateOfResidence === q.state) &&
        (!q.country || g.country === q.country) &&
        (!q.internType || g.internType === q.internType) &&
        (!q.skillId || g.skills.some((s) => s.skillId === q.skillId)) &&
        (!q.institution || (g.institution ?? "").toLowerCase().includes(String(q.institution).toLowerCase()))
      );
    })
    .sort((a, b) =>
      q.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
    )
    .map(adminRow);
}

export function getApplication(id: string): AdminApplicationDetail {
  requireAdmin();
  const a = db.applications.find((x) => x.id === id);
  if (!a) throw notFound("Application");
  const g = graduateById(a.graduateId)!;
  const u = userById(g.userId)!;
  const row = adminRow(a);
  return {
    ...row,
    motivation: a.motivation,
    rejectionReason: a.rejectionReason,
    graduate: {
      ...row.graduate,
      skills: g.skills.map(presentSkill),
      phone: g.phone,
      lga: g.lga,
      workPreference: g.workPreference,
      nyscStateCode: g.nyscStateCode,
      nyscBatch: g.nyscBatch,
      availability: g.availability,
      bio: g.bio,
      hasCv: Boolean(g.cvUploadedAt),
      user: { email: u.email, emailVerified: u.emailVerified, createdAt: u.createdAt },
    },
    events: a.events.map(({ actorId: _a, ...e }) => e),
    notes: a.notes,
    allowedNextStatuses: nextStates(a.status, "ADMIN"),
  };
}

export function changeStatus(id: string, input: z.input<typeof changeStatusSchema>) {
  const admin = requireAdmin();
  const a = db.applications.find((x) => x.id === id);
  if (!a) throw notFound("Application");
  transition(a, input.status, "ADMIN", admin.id, { reason: input.reason, note: input.note });
  return getApplication(id);
}

export function bulkStatus(ids: string[], input: z.input<typeof changeStatusSchema>) {
  const results = ids.map((id) => {
    try {
      changeStatus(id, input);
      return { applicationId: id, ok: true };
    } catch (e) {
      return { applicationId: id, ok: false, error: { message: e instanceof Error ? e.message : "Failed" } };
    }
  });
  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}

export function addNote(id: string, body: string) {
  const admin = requireAdmin();
  const a = db.applications.find((x) => x.id === id);
  if (!a) throw notFound("Application");
  const note = { id: newId("note"), body, authorId: admin.id, authorName: admin.name, createdAt: isoNow() };
  a.notes.unshift(note);
  audit(admin.id, "application.note_added", "Application", id);
  return note;
}

// ─── Companies & openings ─────────────────────────────────────────────────────

export function listCompanies(status?: CompanyVerificationStatus) {
  requireAdmin();
  return db.companies
    .filter((c) => !status || c.verificationStatus === status)
    .map((c) => ({
      ...c,
      _count: {
        openings: db.openings.filter((o) => o.companyId === c.id).length,
        members: db.members.filter((m) => m.companyId === c.id).length,
      },
    }));
}

export function getCompany(id: string) {
  requireAdmin();
  const c = companyById(id);
  if (!c) throw notFound("Company");
  return {
    ...c,
    members: db.members
      .filter((m) => m.companyId === id)
      .map((m) => {
        const u = userById(m.userId)!;
        return {
          id: m.id,
          role: m.role,
          jobTitle: m.jobTitle,
          user: { id: u.id, name: u.name, email: u.email },
        };
      }),
    openings: db.openings
      .filter((o) => o.companyId === id)
      .map((o) => ({ id: o.id, title: o.title, status: o.status, slots: o.slots, country: o.country, city: o.city, state: o.state })),
  };
}

const COMPANY_FLOW: Record<CompanyVerificationStatus, CompanyVerificationStatus[]> = {
  PENDING: ["VERIFIED", "REJECTED"],
  VERIFIED: ["SUSPENDED"],
  SUSPENDED: ["VERIFIED"],
  REJECTED: [],
};
export function setCompanyStatus(id: string, status: CompanyVerificationStatus, reason?: string) {
  const admin = requireAdmin();
  const c = companyById(id);
  if (!c) throw notFound("Company");
  if (!COMPANY_FLOW[c.verificationStatus].includes(status))
    throw new ApiError(
      "INVALID_TRANSITION",
      `Company cannot move from ${c.verificationStatus} to ${status}`,
      409,
    );
  if ((status === "REJECTED" || status === "SUSPENDED") && !reason)
    throw badRequest("Give a reason when rejecting or suspending a company");
  audit(
    admin.id,
    "company.status_changed",
    "Company",
    id,
    { verificationStatus: c.verificationStatus },
    { verificationStatus: status },
  );
  Object.assign(c, {
    verificationStatus: status,
    statusReason: reason ?? null,
    verifiedAt: status === "VERIFIED" ? (c.verifiedAt ?? isoNow()) : c.verifiedAt,
  });
  if (status === "SUSPENDED")
    db.openings
      .filter((o) => o.companyId === id && o.status === "OPEN")
      .forEach((o) => (o.status = "CLOSED"));
  db.members
    .filter((m) => m.companyId === id)
    .forEach((m) =>
      notify(
        m.userId,
        "company.status_changed",
        status === "VERIFIED" ? "Company verified" : "Company status update",
        status === "VERIFIED"
          ? `${c.name} is now verified. You can publish internship openings.`
          : `${c.name} is now ${status.toLowerCase()}.${reason ? ` Reason: ${reason}` : ""}`,
      ),
    );
  return c;
}

export function listOpenings(status?: OpeningStatus) {
  requireAdmin();
  return db.openings.filter((o) => !status || o.status === status).map((o) => presentOpening(o, true));
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export function getSuggestions(openingId: string, limit: number) {
  requireAdmin();
  const o = openingById(openingId);
  if (!o) throw notFound("Opening");
  const c = companyById(o.companyId)!;
  const filled = db.placements.filter((p) => p.openingId === o.id && p.status !== "TERMINATED").length;
  const suggestions = db.applications
    .filter(
      (a) =>
        a.status === "QUALIFIED" &&
        // Only interns SIIP has approved (and not removed) reach companies.
        graduateById(a.graduateId)?.reviewStatus === "APPROVED" &&
        !graduateById(a.graduateId)?.removedAt &&
        (!o.cohortId || a.cohortId === o.cohortId) &&
        !db.matches.some(
          (mt) => mt.openingId === o.id && mt.graduateId === a.graduateId && mt.status === "COMPANY_REJECTED",
        ),
    )
    .map((a) => {
      const g = graduateById(a.graduateId)!;
      return { a, g, s: scoreFor(g, o) };
    })
    .filter((x) => x.s.eligible)
    .sort((x, y) => y.s.total - x.s.total)
    .slice(0, limit)
    .map(({ a, g, s }) => ({
      applicationId: a.id,
      cohortId: a.cohortId,
      score: s.total,
      breakdown: s.breakdown,
      graduate: {
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        internType: g.internType,
        country: g.country,
        city: g.city,
        workPreference: g.workPreference,
        stateOfResidence: g.stateOfResidence,
        institution: g.institution,
        courseOfStudy: g.courseOfStudy,
        degreeClass: g.degreeClass,
        graduationYear: g.graduationYear,
        nyscStatus: g.nyscStatus,
        availability: g.availability,
        bio: g.bio,
        photoUrl: g.photoUrl,
        finalAssessmentPercent: bestFinal(g.id),
        skills: verifiedSkills(g).map((sk) => ({ id: sk.skillId, name: skillName(sk.skillId), level: sk.level })),
      },
    }));
  return {
    opening: {
      id: o.id,
      title: o.title,
      company: { id: c.id, name: c.name, verificationStatus: c.verificationStatus },
      slots: o.slots,
      filled,
      status: o.status,
      workMode: o.workMode,
      country: o.country,
      city: o.city,
      state: o.state,
      durationWeeks: o.durationWeeks,
      startDate: o.startDate,
      mayLeadToFullTime: o.mayLeadToFullTime,
      skills: o.skills.map((sk) => ({ name: skillName(sk.skillId), minLevel: sk.minLevel, required: sk.required })),
    },
    suggestions,
  };
}

export function proposeMatch(openingId: string, applicationId: string) {
  const admin = requireAdmin();
  const o = openingById(openingId);
  const a = db.applications.find((x) => x.id === applicationId);
  if (!o || !a) throw notFound(!o ? "Opening" : "Application");
  if (o.status !== "OPEN") throw conflict("This opening is not open");
  const g = graduateById(a.graduateId)!;
  if (g.reviewStatus !== "APPROVED" || g.removedAt) {
    throw conflict("Only interns whose skills SIIP has approved can be matched");
  }
  const s = scoreFor(g, o);
  if (!s.eligible) throw badRequest(s.ineligibleReason ?? "Graduate is not eligible");
  transition(a, "MATCHED", "SYSTEM", admin.id);
  const mt = {
    id: newId("mch"),
    graduateId: g.id,
    applicationId: a.id,
    openingId: o.id,
    score: s.total,
    scoreBreakdown: s.breakdown,
    status: "PROPOSED" as const,
    createdAt: isoNow(),
    decidedAt: null,
    decisionReason: null,
  };
  db.matches.push(mt);
  audit(admin.id, "match.proposed", "Match", mt.id, null, { status: "PROPOSED", score: s.total });
  db.members
    .filter((mb) => mb.companyId === o.companyId && mb.role === "OWNER")
    .forEach((mb) =>
      notify(
        mb.userId,
        "match.proposed",
        "New candidate to review",
        `A graduate has been matched to ${o.title}.`,
        { matchId: mt.id },
      ),
    );
  return { id: mt.id };
}

export function withdrawMatch(id: string, reason: string) {
  const admin = requireAdmin();
  const mt = db.matches.find((x) => x.id === id);
  if (!mt) throw notFound("Match");
  if (mt.status !== "PROPOSED")
    throw new ApiError("INVALID_TRANSITION", `Match cannot move from ${mt.status} to WITHDRAWN`, 409);
  Object.assign(mt, { status: "WITHDRAWN", decidedAt: isoNow(), decisionReason: reason });
  transition(
    db.applications.find((a) => a.id === mt.applicationId)!,
    "QUALIFIED",
    "SYSTEM",
    admin.id,
  );
  return { id };
}

// ─── Placements & certificates ────────────────────────────────────────────────

export function listPlacements() {
  requireAdmin();
  return db.placements.map((p) => presentPlacement(p));
}

export function getPlacement(id: string): AdminPlacement {
  requireAdmin();
  const p = db.placements.find((x) => x.id === id);
  if (!p) throw notFound("Placement");
  const mt = db.matches.find((x) => x.id === p.matchId)!;
  const app = db.applications.find((x) => x.id === p.applicationId)!;
  const cert = db.certificates.find((c) => c.placementId === id);
  return {
    ...presentPlacement(p, { contact: true }),
    match: { id: mt.id, score: mt.score, scoreBreakdown: mt.scoreBreakdown },
    application: {
      id: app.id,
      status: app.status,
      cohort: { id: app.cohortId, name: cohortById(app.cohortId)!.name },
    },
    checkIns: db.checkIns
      .filter((c) => c.placementId === id)
      .sort((a, b) => a.month - b.month)
      .map(({ placementId: _p, ...c }) => c),
    evaluation: db.evaluations.find((e) => e.placementId === id) ?? null,
    programmeEvaluation: db.programmeEvaluations.get(id) ?? null,
    certificate: cert
      ? { id: cert.id, serialNumber: cert.serialNumber, verificationCode: cert.verificationCode }
      : null,
  };
}

export function completePlacement(id: string) {
  const admin = requireAdmin();
  const p = db.placements.find((x) => x.id === id);
  if (!p) throw notFound("Placement");
  if (p.status !== "ACTIVE")
    throw new ApiError("INVALID_TRANSITION", `Placement cannot move from ${p.status} to COMPLETED`, 409);
  Object.assign(p, { status: "COMPLETED", endedAt: isoNow() });
  transition(
    db.applications.find((a) => a.id === p.applicationId)!,
    "COMPLETED",
    "SYSTEM",
    admin.id,
  );
  return getPlacement(id);
}

export function terminatePlacement(id: string, reason: string) {
  const admin = requireAdmin();
  const p = db.placements.find((x) => x.id === id);
  if (!p) throw notFound("Placement");
  if (p.status !== "ACTIVE")
    throw new ApiError("INVALID_TRANSITION", `Placement cannot move from ${p.status} to TERMINATED`, 409);
  Object.assign(p, { status: "TERMINATED", endedAt: isoNow(), endReason: reason });
  audit(
    admin.id,
    "placement.status_changed",
    "Placement",
    id,
    { status: "ACTIVE" },
    { status: "TERMINATED" },
  );
  return getPlacement(id);
}

export function reviewPlacement(id: string, input: { approvedForCertificate: boolean; notes?: string }) {
  const admin = requireAdmin();
  const p = getPlacement(id);
  if (p.status !== "COMPLETED") throw conflict("The placement must be completed first");
  if (!p.evaluation) throw conflict("The company has not submitted its evaluation yet");
  db.programmeEvaluations.set(id, {
    notes: input.notes ?? null,
    approvedForCertificate: input.approvedForCertificate,
    approvedAt: input.approvedForCertificate ? isoNow() : null,
  });
  audit(admin.id, "placement.reviewed", "Placement", id, null, {
    approvedForCertificate: input.approvedForCertificate,
  });
  return { approvedForCertificate: input.approvedForCertificate };
}

const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = (n: number) =>
  Array.from({ length: n }, () => CODE[Math.floor(Math.random() * CODE.length)]).join("");

export function issueCertificate(id: string) {
  const admin = requireAdmin();
  const p = getPlacement(id);
  if (p.status !== "COMPLETED" || !p.evaluation)
    throw conflict("The placement must be completed and evaluated first");
  if (!p.programmeEvaluation?.approvedForCertificate)
    throw conflict("Approve the placement for a certificate first");
  const existing = db.certificates.find((c) => c.placementId === id);
  if (existing) return { id: existing.id, serialNumber: existing.serialNumber };
  const g = graduateById(p.graduate.id)!;
  const cert = {
    id: newId("crt"),
    placementId: id,
    graduateId: g.id,
    serialNumber: `SIIP-${new Date().getFullYear()}-${code(8)}`,
    verificationCode: `${code(5)}-${code(5)}`,
    issuedAt: isoNow(),
  };
  db.certificates.push(cert);
  audit(admin.id, "certificate.issued", "Certificate", cert.id, null, { serialNumber: cert.serialNumber });
  notify(
    g.userId,
    "certificate.issued",
    "Your certificate is ready",
    "Congratulations! Your SIIP certificate has been issued.",
    { certificateId: cert.id },
  );
  return { id: cert.id, serialNumber: cert.serialNumber };
}

// ─── Reporting ────────────────────────────────────────────────────────────────

export function getAnalytics(cohortId?: string): Analytics {
  requireAdmin();
  const apps = db.applications.filter((a) => !cohortId || a.cohortId === cohortId);
  const byStage: Partial<Record<ApplicationStatus, number>> = {};
  const perCohort = new Map<string, Partial<Record<ApplicationStatus, number>>>();
  apps.forEach((a) => {
    byStage[a.status] = (byStage[a.status] ?? 0) + 1;
    const s = perCohort.get(a.cohortId) ?? {};
    s[a.status] = (s[a.status] ?? 0) + 1;
    perCohort.set(a.cohortId, s);
  });
  const sum = (xs: ApplicationStatus[]) => xs.reduce((n, s) => n + (byStage[s] ?? 0), 0);
  const rate = (p: number, w: number) => (w === 0 ? null : Math.round((p / w) * 1000) / 10);
  const appIds = new Set(apps.map((a) => a.id));
  const places = db.placements.filter((p) => appIds.has(p.applicationId));
  const pc = {
    ACTIVE: places.filter((p) => p.status === "ACTIVE").length,
    COMPLETED: places.filter((p) => p.status === "COMPLETED").length,
    TERMINATED: places.filter((p) => p.status === "TERMINATED").length,
  };
  const gradIds = new Set(apps.map((a) => a.graduateId));
  const attempts = db.attempts.filter((t) => gradIds.has(t.graduateId) && t.status !== "IN_PROGRESS");
  const demand = new Map<string, number>();
  db.openings
    .filter((o) => o.status !== "DRAFT")
    .forEach((o) => o.skills.forEach((s) => demand.set(s.skillId, (demand.get(s.skillId) ?? 0) + o.slots)));
  const supply = new Map<string, number>();
  db.graduates
    .filter((g) => gradIds.has(g.id))
    // Supply counts skills SIIP has verified.
    .forEach((g) => verifiedSkills(g).forEach((s) => supply.set(s.skillId, (supply.get(s.skillId) ?? 0) + 1)));
  return {
    stagesByCohort: [...perCohort.entries()].map(([id, stages]) => ({
      cohortId: id,
      cohortName: cohortById(id)?.name ?? null,
      stages,
    })),
    totals: { applications: apps.length, byStage },
    rates: {
      assessmentPassRate: rate(attempts.filter((t) => t.passed).length, attempts.length),
      placementRate: rate(sum(["PLACED", "COMPLETED"]), sum(["QUALIFIED", "MATCHED", "PLACED", "COMPLETED"])),
      completionRate: rate(pc.COMPLETED, pc.COMPLETED + pc.TERMINATED),
      permanentOfferRate: rate(places.filter((p) => p.offeredPermanentRole).length, places.length),
    },
    counts: {
      assessmentAttempts: attempts.length,
      assessmentPasses: attempts.filter((t) => t.passed).length,
      placements: pc,
      permanentOffers: places.filter((p) => p.offeredPermanentRole).length,
    },
    skills: db.skills
      .map((s) => ({
        skillId: s.id,
        name: s.name,
        demand: demand.get(s.id) ?? 0,
        supply: supply.get(s.id) ?? 0,
        gap: (demand.get(s.id) ?? 0) - (supply.get(s.id) ?? 0),
      }))
      .sort((a, b) => b.demand - a.demand)
      .slice(0, 12),
  };
}

export function exportCsv(kind: "applications" | "placements") {
  requireAdmin();
  if (kind === "applications") {
    return toCsv(
      [
        "application_id",
        "cohort",
        "status",
        "first_name",
        "last_name",
        "email",
        "state",
        "institution",
        "course",
      ],
      db.applications.map((a) => {
        const g = graduateById(a.graduateId)!;
        return [
          a.id,
          cohortById(a.cohortId)!.name,
          a.status,
          g.firstName,
          g.lastName,
          userById(g.userId)!.email,
          g.stateOfResidence ?? "",
          g.institution ?? "",
          g.courseOfStudy ?? "",
        ];
      }),
    );
  }
  return toCsv(
    ["placement_id", "status", "company", "role", "graduate", "start_date", "end_date", "permanent_offer"],
    db.placements.map((p) => {
      const g = graduateById(p.graduateId)!;
      return [
        p.id,
        p.status,
        companyById(p.companyId)!.name,
        openingById(p.openingId)!.title,
        `${g.firstName} ${g.lastName}`,
        p.startDate,
        p.endDate,
        String(p.offeredPermanentRole),
      ];
    }),
  );
}

export function listAudit() {
  requireAdmin();
  return db.audit;
}

// ─── Public ───────────────────────────────────────────────────────────────────

export function verifyCertificate(raw: string) {
  const c = db.certificates.find((x) => x.verificationCode === raw.trim().toUpperCase());
  if (!c) throw notFound("Certificate");
  const p = db.placements.find((x) => x.id === c.placementId)!;
  const g = graduateById(c.graduateId)!;
  return {
    valid: true,
    graduateName: `${g.firstName} ${g.lastName}`,
    cohortName: cohortById(db.applications.find((a) => a.id === p.applicationId)!.cohortId)!.name,
    companyName: companyById(p.companyId)!.name,
    roleTitle: openingById(p.openingId)!.title,
    issuedAt: c.issuedAt,
    serialNumber: c.serialNumber,
  };
}

export * from "./review";
