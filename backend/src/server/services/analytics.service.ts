import type { ApplicationStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";

const rate = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);

/** Reached qualification or beyond (the pool placement rate is measured against). */
const QUALIFIED_OR_BEYOND: ApplicationStatus[] = ["QUALIFIED", "MATCHED", "PLACED", "COMPLETED"];
const PLACED_OR_BEYOND: ApplicationStatus[] = ["PLACED", "COMPLETED"];

/** Programme analytics, for one cohort or all. Percentages are 0-100 (null when there is no data). */
/** Interns approved since cohorts were retired have no cohort; they are grouped here. */
const WAITING_LIST = "waiting-list";

export async function getAnalytics(cohortId?: string) {
  const appScope = cohortId ? { cohortId } : {};
  const placementScope = cohortId ? { application: { cohortId } } : {};

  const [stageRows, cohorts, attempts, placementRows, offers, demand, supply] = await Promise.all([
    db.application.groupBy({ by: ["cohortId", "status"], where: appScope, _count: { _all: true } }),
    db.cohort.findMany({ where: cohortId ? { id: cohortId } : {}, select: { id: true, name: true } }),
    db.attempt.groupBy({
      by: ["passed"],
      where: { status: { not: "IN_PROGRESS" }, ...(cohortId ? { assessment: { cohortId } } : {}) },
      _count: { _all: true },
    }),
    db.placement.groupBy({ by: ["status"], where: placementScope, _count: { _all: true } }),
    db.placement.count({ where: { ...placementScope, offeredPermanentRole: true } }),
    // Demand: slots asking for each skill (open and filled openings).
    db.openingSkill.findMany({
      where: { opening: { status: { not: "DRAFT" }, ...(cohortId ? { cohortId } : {}) } },
      select: { skillId: true, skill: { select: { name: true } }, opening: { select: { slots: true } } },
    }),
    // Supply: interns in the programme with each skill verified by SIIP.
    db.graduateSkill.groupBy({
      by: ["skillId"],
      where: {
        status: "VERIFIED",
        skillId: { not: null },
        graduate: { applications: { some: { ...appScope, status: { notIn: ["REJECTED", "WITHDRAWN"] } } } },
      },
      _count: { _all: true },
    }),
  ]);

  const cohortName = new Map(cohorts.map((c) => [c.id, c.name]));
  const stagesByCohort = new Map<string, Record<string, number>>();
  const totals: Partial<Record<ApplicationStatus, number>> = {};
  for (const row of stageRows) {
    const cohortKey = row.cohortId ?? WAITING_LIST;
    const stages = stagesByCohort.get(cohortKey) ?? {};
    stages[row.status] = row._count._all;
    stagesByCohort.set(cohortKey, stages);
    totals[row.status] = (totals[row.status] ?? 0) + row._count._all;
  }
  const sum = (statuses: ApplicationStatus[]) => statuses.reduce((n, s) => n + (totals[s] ?? 0), 0);

  const finished = attempts.reduce((n, r) => n + r._count._all, 0);
  const passed = attempts.find((r) => r.passed === true)?._count._all ?? 0;
  const placements = Object.fromEntries(placementRows.map((r) => [r.status, r._count._all]));
  const placementTotal = placementRows.reduce((n, r) => n + r._count._all, 0);
  const completed = placements.COMPLETED ?? 0;
  const ended = completed + (placements.TERMINATED ?? 0);

  const demandBySkill = new Map<string, { name: string; demand: number }>();
  for (const d of demand) {
    const entry = demandBySkill.get(d.skillId) ?? { name: d.skill.name, demand: 0 };
    entry.demand += d.opening.slots;
    demandBySkill.set(d.skillId, entry);
  }
  const supplyBySkill = new Map(
    supply.flatMap((s) => (s.skillId ? [[s.skillId, s._count._all] as const] : [])),
  );
  const skillIds = new Set([...demandBySkill.keys(), ...supplyBySkill.keys()]);
  const names = new Map(
    (await db.skill.findMany({ where: { id: { in: [...skillIds] } }, select: { id: true, name: true } })).map(
      (s) => [s.id, s.name],
    ),
  );
  const skills = [...skillIds]
    .map((id) => ({
      skillId: id,
      name: names.get(id) ?? "",
      demand: demandBySkill.get(id)?.demand ?? 0,
      supply: supplyBySkill.get(id) ?? 0,
    }))
    .map((s) => ({ ...s, gap: s.demand - s.supply }))
    .sort((a, b) => b.demand - a.demand || b.supply - a.supply)
    .slice(0, 20);

  return {
    stagesByCohort: [...stagesByCohort.entries()].map(([id, stages]) => ({
      cohortId: id,
      cohortName: id === WAITING_LIST ? "Waiting list" : (cohortName.get(id) ?? null),
      stages,
    })),
    totals: { applications: sum(Object.keys(totals) as ApplicationStatus[]), byStage: totals },
    rates: {
      assessmentPassRate: rate(passed, finished),
      placementRate: rate(sum(PLACED_OR_BEYOND), sum(QUALIFIED_OR_BEYOND)),
      completionRate: rate(completed, ended),
      permanentOfferRate: rate(offers, placementTotal),
    },
    counts: { assessmentAttempts: finished, assessmentPasses: passed, placements, permanentOffers: offers },
    skills,
  };
}
