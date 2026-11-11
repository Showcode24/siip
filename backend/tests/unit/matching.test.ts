import { describe, expect, it } from "vitest";
import { MATCH_WEIGHTS, scoreMatch, type MatchCandidate, type MatchOpening } from "@/server/lib/matching";

const opening: MatchOpening = {
  state: "Lagos",
  workMode: "ONSITE",
  schedule: "FULL_TIME",
  openToNysc: true,
  preferredDisciplines: ["Mass Communication"],
  skills: [
    { skillId: "social", minLevel: "INTERMEDIATE", required: true },
    { skillId: "video", minLevel: null, required: false },
  ],
};

const ideal: MatchCandidate = {
  stateOfResidence: "Lagos",
  courseOfStudy: "Mass Communication",
  availability: "FULL_TIME",
  nyscStatus: "COMPLETED",
  skills: [
    { skillId: "social", level: "ADVANCED" },
    { skillId: "video", level: "BEGINNER" },
  ],
  finalAssessmentPercent: 100,
};

describe("scoreMatch", () => {
  it("weights add up to 100 and a perfect candidate scores 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(scoreMatch(ideal, opening).total).toBe(100);
  });

  it("gives half credit for a skill below the requested level", () => {
    const r = scoreMatch({ ...ideal, skills: [{ skillId: "social", level: "BEGINNER" }] }, opening);
    // required: 0.5 of 1, optional missing: 0 of 0.5 => 0.5 / 1.5
    expect(r.breakdown.skills.fit).toBeCloseTo(1 / 3);
    expect(r.breakdown.skills.detail).toBe("1 of 2 skills");
  });

  it("scores location, schedule and discipline mismatches", () => {
    const r = scoreMatch(
      { ...ideal, stateOfResidence: "Kano", availability: "WEEKENDS", courseOfStudy: "Chemistry" },
      opening,
    );
    expect(r.breakdown.location.fit).toBe(0);
    expect(r.breakdown.availability.fit).toBe(0);
    expect(r.breakdown.discipline.fit).toBe(0);
    expect(
      scoreMatch({ ...ideal, stateOfResidence: "Kano" }, { ...opening, workMode: "REMOTE" }).breakdown
        .location.fit,
    ).toBe(1);
  });

  it("matches disciplines on shared words", () => {
    const r = scoreMatch({ ...ideal, courseOfStudy: "Communication Arts" }, opening);
    expect(r.breakdown.discipline.fit).toBe(1);
  });

  it("makes serving corps members ineligible when the opening excludes them", () => {
    const r = scoreMatch({ ...ideal, nyscStatus: "SERVING" }, { ...opening, openToNysc: false });
    expect(r.eligible).toBe(false);
    expect(scoreMatch({ ...ideal, nyscStatus: "SERVING" }, opening).eligible).toBe(true);
  });

  it("scores zero for a missing final assessment", () => {
    expect(scoreMatch({ ...ideal, finalAssessmentPercent: null }, opening).breakdown.assessment.points).toBe(
      0,
    );
  });
});

describe("location across countries", () => {
  const london: MatchOpening = { ...opening, country: "GB", city: "London", state: null, workMode: "ONSITE" };
  const loc = (c: Partial<MatchCandidate>, o: MatchOpening) => scoreMatch({ ...ideal, ...c }, o).breakdown.location;

  it("fits interns in the same city, whatever the case", () => {
    expect(loc({ country: "GB", city: "london", stateOfResidence: null }, london).fit).toBe(1);
  });

  it("gives no location credit for on-site or hybrid roles in another country", () => {
    expect(loc({ country: "NG", city: "Lagos" }, london).fit).toBe(0);
    expect(loc({ country: "NG", city: "Lagos" }, { ...london, workMode: "HYBRID" }).fit).toBe(0);
  });

  it("gives partial credit in the same country for hybrid roles only", () => {
    expect(loc({ country: "GB", city: "Leeds", stateOfResidence: null }, { ...london, workMode: "HYBRID" }).fit).toBe(0.3);
    expect(loc({ country: "GB", city: "Leeds", stateOfResidence: null }, london).fit).toBe(0);
  });

  it("ignores location for remote roles", () => {
    expect(loc({ country: "KE", city: "Nairobi" }, { ...london, workMode: "REMOTE" }).fit).toBe(1);
  });

  it("still matches Nigerian interns by state", () => {
    expect(loc({ country: "NG", city: "Ikeja", stateOfResidence: "Lagos" }, { ...opening, country: "NG", city: "Lagos" }).fit).toBe(1);
  });
});
