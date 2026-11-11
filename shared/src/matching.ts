// Match scoring: every rule and weight lives in this file.
//
// Hard rules first (eligibility): an intern is only ever suggested when every
// required skill is VERIFIED at the requested level or higher (Expert only gets
// Experts; "Any level" takes any verified level), and, for on-site roles, they
// live where the role is (hybrid: same country; remote: anywhere). Candidates'
// skills passed in here must already be verified skills at the verified level.
//
// Eligible interns are then ranked: a score is 0-100, each factor scores 0..1
// and is multiplied by its weight.
import type { Availability, NyscStatus, SkillLevel, WorkMode, WorkSchedule } from "./enums";

export const MATCH_WEIGHTS = {
  skills: 40,
  assessment: 20,
  discipline: 15,
  location: 10,
  availability: 10,
  nysc: 5,
} as const;

export type MatchFactor = keyof typeof MATCH_WEIGHTS;

const LEVEL_RANK: Record<SkillLevel, number> = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 };

/** Optional ("nice to have") skills count half as much as required ones. */
const OPTIONAL_SKILL_WEIGHT = 0.5;

const LEVEL_NAME: Record<SkillLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

/** A verified level meets a request when it is at or above it (no level = any level). */
export const meetsLevel = (has: SkillLevel, wanted: SkillLevel | null) =>
  !wanted || LEVEL_RANK[has] >= LEVEL_RANK[wanted];

/** How well an availability fits a schedule. FLEXIBLE fits everything. */
const AVAILABILITY_FIT: Record<Availability, Record<WorkSchedule, number>> = {
  FLEXIBLE: { FULL_TIME: 1, PART_TIME: 1, WEEKENDS: 1 },
  FULL_TIME: { FULL_TIME: 1, PART_TIME: 0.75, WEEKENDS: 0.5 },
  PART_TIME: { FULL_TIME: 0.25, PART_TIME: 1, WEEKENDS: 0.5 },
  WEEKENDS: { FULL_TIME: 0, PART_TIME: 0.25, WEEKENDS: 1 },
};

/** Hybrid interns elsewhere in the same country can still relocate; on-site ones must already be there. */
const OTHER_CITY_FIT: Record<WorkMode, number> = { REMOTE: 1, HYBRID: 0.3, ONSITE: 0 };

/** Full availability for the 3 months scores highest; NOT_YET may be mobilised for NYSC mid-internship. */
const NYSC_FIT: Record<NyscStatus, number> = { COMPLETED: 1, EXEMPTED: 1, SERVING: 0.75, NOT_YET: 0.5 };

export interface MatchCandidate {
  country?: string | null;
  city?: string | null;
  stateOfResidence: string | null;
  courseOfStudy: string | null;
  availability: Availability | null;
  nyscStatus: NyscStatus;
  skills: Array<{ skillId: string; level: SkillLevel }>;
  /** Best FINAL assessment percentage (0-100), null if none taken. */
  finalAssessmentPercent: number | null;
}

export interface MatchOpening {
  country?: string | null;
  city?: string | null;
  state: string | null;
  workMode: WorkMode;
  schedule: WorkSchedule;
  openToNysc: boolean;
  preferredDisciplines: string[];
  skills: Array<{ skillId: string; minLevel: SkillLevel | null; required: boolean; name?: string }>;
}

export interface FactorScore {
  /** 0..1 */
  fit: number;
  weight: number;
  points: number;
  detail: string;
}

export interface MatchScore {
  eligible: boolean;
  ineligibleReason: string | null;
  total: number;
  breakdown: Record<MatchFactor, FactorScore>;
}

const same = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** Where the intern lives relative to the role: same city, same country, or elsewhere. */
function placeRelation(c: MatchCandidate, o: MatchOpening): "city" | "country" | "abroad" {
  // Openings and interns from before country/city existed are all in Nigeria.
  const oCountry = o.country ?? "NG";
  const cCountry = c.country ?? "NG";
  if (cCountry !== oCountry) return "abroad";
  if (same(c.city, o.city)) return "city";
  if (oCountry === "NG" && o.state && c.stateOfResidence === o.state) return "city";
  return "country";
}

/** Hard rules: a candidate failing these is never suggested or proposed. */
export function eligibility(c: MatchCandidate, o: MatchOpening): string | null {
  if (!o.openToNysc && c.nyscStatus === "SERVING") return "Opening is not open to serving NYSC members";
  const verified = new Map(c.skills.map((s) => [s.skillId, s.level]));
  for (const s of o.skills.filter((x) => x.required)) {
    const has = verified.get(s.skillId);
    const what = s.name ?? "a required skill";
    if (!has) return `No verified ${what}`;
    if (!meetsLevel(has, s.minLevel)) {
      return `${what} is verified at ${LEVEL_NAME[has]}; the role needs ${LEVEL_NAME[s.minLevel!]} or above`;
    }
  }
  if (o.workMode !== "REMOTE") {
    const where = placeRelation(c, o);
    if (where === "abroad") return "Lives in another country";
    if (o.workMode === "ONSITE" && where !== "city") return `Doesn't live in ${o.city ?? o.state ?? "the role's city"}`;
  }
  return null;
}

/** Share of requested skills the intern has verified at the requested level (no credit below it). */
function skillFit(c: MatchCandidate, o: MatchOpening) {
  if (o.skills.length === 0) return { fit: 1, detail: "No skills requested" };
  const verified = new Map(c.skills.map((s) => [s.skillId, s.level]));
  let earned = 0;
  let possible = 0;
  let matched = 0;
  for (const s of o.skills) {
    const weight = s.required ? 1 : OPTIONAL_SKILL_WEIGHT;
    possible += weight;
    const has = verified.get(s.skillId);
    if (!has || !meetsLevel(has, s.minLevel)) continue;
    matched++;
    earned += weight;
  }
  return { fit: earned / possible, detail: `${matched} of ${o.skills.length} skills at the level asked` };
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2),
  );

function disciplineFit(c: MatchCandidate, o: MatchOpening) {
  if (o.preferredDisciplines.length === 0) return { fit: 1, detail: "Any discipline" };
  if (!c.courseOfStudy) return { fit: 0, detail: "Course of study missing" };
  const course = c.courseOfStudy.toLowerCase();
  const courseWords = words(course);
  const hit = o.preferredDisciplines.find((d) => {
    const pref = d.toLowerCase();
    return course.includes(pref) || pref.includes(course) || [...words(pref)].some((w) => courseWords.has(w));
  });
  return hit ? { fit: 1, detail: `Matches "${hit}"` } : { fit: 0, detail: "Different discipline" };
}

function locationFit(c: MatchCandidate, o: MatchOpening) {
  if (o.workMode === "REMOTE") return { fit: 1, detail: "Remote role" };
  const place = o.city ?? o.state ?? "the role's city";
  const where = placeRelation(c, o);
  if (where === "abroad") return { fit: 0, detail: "Lives in another country" };
  if (where === "city") return { fit: 1, detail: `Lives in ${place}` };
  return { fit: OTHER_CITY_FIT[o.workMode], detail: `Lives outside ${place}` };
}

function availabilityFit(c: MatchCandidate, o: MatchOpening) {
  if (!c.availability) return { fit: 0, detail: "Availability missing" };
  return { fit: AVAILABILITY_FIT[c.availability][o.schedule], detail: `${c.availability} for ${o.schedule}` };
}

export function scoreMatch(c: MatchCandidate, o: MatchOpening): MatchScore {
  const fits: Record<MatchFactor, { fit: number; detail: string }> = {
    skills: skillFit(c, o),
    assessment:
      c.finalAssessmentPercent === null
        ? { fit: 0, detail: "No final assessment" }
        : { fit: c.finalAssessmentPercent / 100, detail: `${c.finalAssessmentPercent}% in final assessment` },
    discipline: disciplineFit(c, o),
    location: locationFit(c, o),
    availability: availabilityFit(c, o),
    nysc: { fit: NYSC_FIT[c.nyscStatus], detail: `NYSC ${c.nyscStatus}` },
  };
  const breakdown = Object.fromEntries(
    (Object.keys(MATCH_WEIGHTS) as MatchFactor[]).map((k) => {
      const weight = MATCH_WEIGHTS[k];
      const points = Math.round(fits[k].fit * weight * 10) / 10;
      return [k, { ...fits[k], weight, points }];
    }),
  ) as Record<MatchFactor, FactorScore>;
  const total = Math.round(Object.values(breakdown).reduce((sum, f) => sum + f.points, 0) * 10) / 10;
  const ineligibleReason = eligibility(c, o);
  return { eligible: ineligibleReason === null, ineligibleReason, total, breakdown };
}
