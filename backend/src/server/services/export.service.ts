import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { toCsv, type CsvValue } from "@/server/lib/csv";
import type { applicationExportQuery, placementExportQuery } from "@/server/validators/admin";

const BATCH = 500;

/** Reads every matching row in id order, BATCH at a time. */
async function readAll<T extends { id: string }>(fetch: (cursor?: string) => Promise<T[]>): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const rows = await fetch(cursor);
    all.push(...rows);
    if (rows.length < BATCH) return all;
    cursor = rows[rows.length - 1].id;
  }
}

const page = (cursor?: string) => ({
  take: BATCH,
  orderBy: { id: "asc" as const },
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
});

/** Exports contain personal data, so every export is audited (filters only, no data). */
export async function exportApplications(actor: AuditActor, query: z.infer<typeof applicationExportQuery>) {
  const where: Prisma.ApplicationWhereInput = {
    ...(query.cohortId ? { cohortId: query.cohortId } : {}),
    ...(query.status?.length ? { status: { in: query.status } } : {}),
    graduate: { user: { deletedAt: null } },
  };
  const rows = await readAll((cursor) =>
    db.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        statusChangedAt: true,
        cohort: { select: { name: true } },
        graduate: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            stateOfResidence: true,
            lga: true,
            institution: true,
            courseOfStudy: true,
            degreeClass: true,
            graduationYear: true,
            nyscStatus: true,
            availability: true,
            completenessScore: true,
            user: { select: { email: true } },
            skills: { select: { level: true, skill: { select: { name: true } } } },
          },
        },
      },
      ...page(cursor),
    }),
  );
  await recordAudit(db, {
    actor,
    action: "export.applications",
    entityType: "Export",
    entityId: "applications",
    metadata: { filters: JSON.parse(JSON.stringify(query)), rows: rows.length },
  });
  const header = [
    "application_id",
    "cohort",
    "status",
    "applied_at",
    "status_changed_at",
    "first_name",
    "last_name",
    "email",
    "phone",
    "state",
    "lga",
    "institution",
    "course",
    "degree_class",
    "graduation_year",
    "nysc_status",
    "availability",
    "skills",
    "profile_completeness",
  ];
  const body: CsvValue[][] = rows.map((r) => {
    const g = r.graduate;
    return [
      r.id,
      r.cohort.name,
      r.status,
      r.createdAt,
      r.statusChangedAt,
      g.firstName,
      g.lastName,
      g.user.email,
      g.phone,
      g.stateOfResidence,
      g.lga,
      g.institution,
      g.courseOfStudy,
      g.degreeClass,
      g.graduationYear,
      g.nyscStatus,
      g.availability,
      g.skills.map((s) => `${s.skill.name} (${s.level})`).join("; "),
      g.completenessScore,
    ];
  });
  return toCsv(header, body);
}

export async function exportPlacements(actor: AuditActor, query: z.infer<typeof placementExportQuery>) {
  const where: Prisma.PlacementWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.cohortId ? { application: { cohortId: query.cohortId } } : {}),
  };
  const rows = await readAll((cursor) =>
    db.placement.findMany({
      where,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        endedAt: true,
        endReason: true,
        offeredPermanentRole: true,
        permanentOfferDate: true,
        company: { select: { name: true } },
        opening: { select: { title: true } },
        application: { select: { cohort: { select: { name: true } } } },
        graduate: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
        supervisor: { select: { user: { select: { name: true } } } },
        evaluation: { select: { overallScore: true, wouldHire: true } },
        certificate: { select: { serialNumber: true } },
      },
      ...page(cursor),
    }),
  );
  await recordAudit(db, {
    actor,
    action: "export.placements",
    entityType: "Export",
    entityId: "placements",
    metadata: { filters: JSON.parse(JSON.stringify(query)), rows: rows.length },
  });
  const header = [
    "placement_id",
    "cohort",
    "status",
    "company",
    "role",
    "graduate_first_name",
    "graduate_last_name",
    "graduate_email",
    "supervisor",
    "start_date",
    "end_date",
    "ended_at",
    "end_reason",
    "evaluation_score",
    "would_hire",
    "permanent_offer",
    "permanent_offer_date",
    "certificate_serial",
  ];
  const body: CsvValue[][] = rows.map((r) => [
    r.id,
    r.application.cohort.name,
    r.status,
    r.company.name,
    r.opening.title,
    r.graduate.firstName,
    r.graduate.lastName,
    r.graduate.user.email,
    r.supervisor?.user.name,
    r.startDate,
    r.endDate,
    r.endedAt,
    r.endReason,
    r.evaluation?.overallScore,
    r.evaluation?.wouldHire,
    r.offeredPermanentRole,
    r.permanentOfferDate,
    r.certificate?.serialNumber,
  ]);
  return toCsv(header, body);
}
