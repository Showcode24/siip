import type { z } from "zod";
import type { applySchema } from "@siip/shared/validators/application";
import type { checkInSchema } from "@siip/shared/validators/internship";
import type { setSkillsSchema, updateProfileSchema } from "@siip/shared/validators/graduate";
import { updateProfileSchema as profileSchema } from "@siip/shared/validators/graduate";
import { missingForApplication } from "@siip/shared/profile-completeness";
import type { Certificate, MyApplication, MyPlacement } from "@/client/api/types";
import { cohortById, companyById, db, iso, newId, notify, openingById } from "./db";
import {
  badRequest,
  canMove,
  conflict,
  currentApplication,
  notFound,
  presentPlacement,
  presentProfile,
  requireGraduate,
  requireUser,
  scoringInput,
  transition,
} from "./logic";

export function getProfile() {
  return presentProfile(requireGraduate().graduate);
}

export function updateProfile(input: z.input<typeof updateProfileSchema>) {
  const { graduate } = requireGraduate();
  Object.assign(graduate, profileSchema.parse(input), { updatedAt: new Date().toISOString() });
  return presentProfile(graduate);
}

export function setSkills(input: z.input<typeof setSkillsSchema>) {
  const { graduate } = requireGraduate();
  graduate.skills = input.skills.map((s) => ({ skillId: s.skillId, level: s.level }));
  return presentProfile(graduate);
}

export function confirmUpload(kind: "cv" | "photo", file: File) {
  const { graduate } = requireGraduate();
  if (kind === "cv") {
    if (!file.name.toLowerCase().endsWith(".pdf")) throw badRequest("Unsupported file type. Allowed: pdf.");
    if (file.size > 5 * 1024 * 1024) throw badRequest("File is too large. The limit is 5 MB.");
    graduate.cvUploadedAt = new Date().toISOString();
  } else {
    if (file.size > 2 * 1024 * 1024) throw badRequest("File is too large. The limit is 2 MB.");
    graduate.photoUrl = URL.createObjectURL(file);
  }
  return presentProfile(graduate);
}

export const listSkills = () => db.skills;

export function listOpenCohorts() {
  const now = new Date().toISOString();
  return db.cohorts
    .filter(
      (c) => c.status === "APPLICATIONS_OPEN" && c.applicationOpensAt <= now && c.applicationClosesAt > now,
    )
    .map(({ capacity: _c, status: _s, createdAt: _d, ...c }) => c);
}

function presentApplication(id: string): MyApplication {
  const { graduate } = requireGraduate();
  const a = db.applications.find((x) => x.id === id && x.graduateId === graduate.id);
  if (!a) throw notFound("Application");
  const c = cohortById(a.cohortId)!;
  return {
    id: a.id,
    status: a.status,
    motivation: a.motivation,
    rejectionReason: a.rejectionReason,
    createdAt: a.createdAt,
    statusChangedAt: a.statusChangedAt,
    cohort: {
      id: c.id,
      name: c.name,
      trainingStartsAt: c.trainingStartsAt,
      trainingEndsAt: c.trainingEndsAt,
      internshipStartsAt: c.internshipStartsAt,
      internshipEndsAt: c.internshipEndsAt,
    },
    timeline: a.events.map(({ actorId: _a, ...e }) => e),
    canWithdraw: canMove(a.status, "WITHDRAWN", "GRADUATE"),
  };
}

export function listApplications() {
  const { graduate } = requireGraduate();
  return db.applications
    .filter((a) => a.graduateId === graduate.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => {
      const { timeline: _t, motivation: _m, rejectionReason: _r, ...rest } = presentApplication(a.id);
      return rest;
    });
}

export const getApplication = (id: string) => presentApplication(id);

export function apply(input: z.input<typeof applySchema>) {
  const { user, graduate } = requireGraduate();
  const cohort = cohortById(input.cohortId);
  if (!cohort) throw notFound("Cohort");
  const now = new Date().toISOString();
  if (cohort.status !== "APPLICATIONS_OPEN" || cohort.applicationClosesAt <= now)
    throw badRequest("Applications for this cohort are not open");
  const missing = missingForApplication(scoringInput(graduate));
  if (missing.length) throw badRequest("Complete your profile before applying", { missing });
  const active = currentApplication(graduate.id);
  if (active && active.status !== "COMPLETED")
    throw conflict(`You already have an active application (${cohortById(active.cohortId)!.name})`);
  const app = {
    id: newId("app"),
    graduateId: graduate.id,
    cohortId: cohort.id,
    status: "SUBMITTED" as const,
    motivation: input.motivation ?? null,
    rejectionReason: null,
    createdAt: now,
    statusChangedAt: now,
    events: [
      { fromStatus: null, toStatus: "SUBMITTED" as const, actorId: user.id, note: null, createdAt: now },
    ],
    notes: [],
  };
  db.applications.push(app);
  notify(
    user.id,
    "application.status_changed",
    "Application received",
    `Your application to ${cohort.name} has been received.`,
    { applicationId: app.id, status: "SUBMITTED" },
  );
  return presentApplication(app.id);
}

export function withdraw(id: string, reason?: string) {
  const { user, graduate } = requireGraduate();
  const a = db.applications.find((x) => x.id === id && x.graduateId === graduate.id);
  if (!a) throw notFound("Application");
  transition(a, "WITHDRAWN", "GRADUATE", user.id, { reason });
  return presentApplication(id);
}

export function getPlacement(): MyPlacement {
  const { graduate } = requireGraduate();
  const match = db.matches
    .filter(
      (m) => m.graduateId === graduate.id && (m.status === "PROPOSED" || m.status === "COMPANY_ACCEPTED"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const placement = db.placements
    .filter((p) => p.graduateId === graduate.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const o = match ? openingById(match.openingId)! : null;
  return {
    match:
      match && o
        ? {
            id: match.id,
            status: match.status,
            createdAt: match.createdAt,
            opening: { title: o.title, company: { name: companyById(o.companyId)!.name } },
          }
        : null,
    placement: placement ? presentPlacement(placement, { companyDetails: true }) : null,
  };
}

function myPlacementRecord() {
  const { graduate } = requireGraduate();
  const p = db.placements
    .filter((x) => x.graduateId === graduate.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!p) throw notFound("Placement");
  return p;
}

/** 1-based internship month today (0 before start), capped at 3 — same as the backend. */
export function internshipMonth(startDate: string, now = new Date()) {
  const s = new Date(startDate);
  if (now < s) return 0;
  const months = (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + now.getUTCMonth() - s.getUTCMonth();
  return Math.min(3, months + (now.getUTCDate() >= s.getUTCDate() ? 0 : -1) + 1);
}

export function listCheckIns() {
  const p = myPlacementRecord();
  return db.checkIns
    .filter((c) => c.placementId === p.id && c.authorType === "INTERN")
    .sort((a, b) => a.month - b.month)
    .map(({ placementId: _p, ...c }) => c);
}

export function submitCheckIn(input: z.input<typeof checkInSchema>) {
  const p = myPlacementRecord();
  if (p.status !== "ACTIVE") throw conflict("Check-ins are only for active internships");
  const current = internshipMonth(p.startDate);
  if (input.month > current)
    throw badRequest(
      current === 0
        ? "The internship has not started yet"
        : `You can submit check-ins up to month ${current}`,
    );
  if (db.checkIns.some((c) => c.placementId === p.id && c.authorType === "INTERN" && c.month === input.month))
    throw conflict(`The month ${input.month} check-in has already been submitted`);
  const c = {
    id: newId("chk"),
    placementId: p.id,
    authorType: "INTERN" as const,
    month: input.month,
    progressNote: input.progressNote,
    challenges: input.challenges ?? null,
    rating: input.rating ?? null,
    createdAt: new Date().toISOString(),
  };
  db.checkIns.push(c);
  const { placementId: _p, ...rest } = c;
  return rest;
}

export function listCertificates(): Certificate[] {
  const { graduate } = requireGraduate();
  return db.certificates
    .filter((c) => c.graduateId === graduate.id)
    .map((c) => {
      const p = db.placements.find((x) => x.id === c.placementId)!;
      const o = openingById(p.openingId)!;
      return {
        id: c.id,
        serialNumber: c.serialNumber,
        verificationCode: c.verificationCode,
        issuedAt: c.issuedAt,
        ready: true,
        verifyUrl: `/verify?code=${c.verificationCode}`,
        placement: { company: { name: companyById(p.companyId)!.name }, opening: { title: o.title } },
      };
    });
}

// ─── Notifications (any signed-in user) ───────────────────────────────────────

export function listNotifications(unread?: boolean) {
  const user = requireUser();
  return db.notifications
    .filter((n) => n.userId === user.id && (!unread || !n.readAt))
    .map(({ userId: _u, ...n }) => n);
}

export function markRead(id: string) {
  const user = requireUser();
  const n = db.notifications.find((x) => x.id === id && x.userId === user.id);
  if (!n) throw notFound("Notification");
  n.readAt = new Date().toISOString();
  return { id, read: true };
}

export function markAllRead() {
  const user = requireUser();
  let updated = 0;
  db.notifications.forEach((n) => {
    if (n.userId === user.id && !n.readAt) {
      n.readAt = new Date().toISOString();
      updated++;
    }
  });
  return { updated };
}

export { iso };
