import { describe, expect, it } from "vitest";
import { normaliseNigerianPhone } from "@/server/lib/nigeria";
import {
  computeCompleteness,
  missingForApplication,
  type ProfileForScoring,
} from "@/server/lib/profile-completeness";
import { cohortDateProblem } from "@/server/validators/cohort";
import { updateProfileSchema } from "@/server/validators/graduate";

const empty: ProfileForScoring = {
  phone: null,
  stateOfResidence: null,
  lga: null,
  institution: null,
  courseOfStudy: null,
  degreeClass: null,
  graduationYear: null,
  availability: null,
  bio: null,
  cvPublicId: null,
  photoUrl: null,
  skillCount: 0,
};

const full: ProfileForScoring = {
  phone: "+2348031234567",
  stateOfResidence: "Lagos",
  lga: "Ikeja",
  institution: "University of Lagos",
  courseOfStudy: "Economics",
  degreeClass: "SECOND_CLASS_UPPER",
  graduationYear: 2025,
  availability: "FULL_TIME",
  bio: "Hello",
  cvPublicId: "siip/cvs/g1/abc.pdf",
  photoUrl: "https://example.com/p.jpg",
  skillCount: 3,
};

describe("computeCompleteness", () => {
  it("scores an empty profile 0 and a full profile 100", () => {
    expect(computeCompleteness(empty)).toBe(0);
    expect(computeCompleteness(full)).toBe(100);
  });

  it("gives partial credit for skills up to three", () => {
    expect(computeCompleteness({ ...empty, skillCount: 1 })).toBe(3);
    expect(computeCompleteness({ ...empty, skillCount: 10 })).toBe(10);
  });

  it("treats blank strings as missing", () => {
    expect(computeCompleteness({ ...empty, bio: "   " })).toBe(0);
  });
});

describe("missingForApplication", () => {
  it("lists every required field on an empty profile", () => {
    expect(missingForApplication(empty)).toEqual([
      "Phone number",
      "State of residence",
      "Institution",
      "Course of study",
      "Graduation year",
      "Availability",
      "CV (PDF)",
      "At least one skill",
    ]);
  });

  it("does not require optional fields (photo, bio, LGA, degree class)", () => {
    expect(
      missingForApplication({ ...full, photoUrl: null, bio: null, lga: null, degreeClass: null }),
    ).toEqual([]);
  });
});

describe("normaliseNigerianPhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["0803 123 4567", "+2348031234567"],
    ["+234 803-123-4567", "+2348031234567"],
    ["2349061234567", "+2349061234567"],
    ["07011112222", "+2347011112222"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseNigerianPhone(input)).toBe(expected);
  });

  it.each(["12345", "0603 123 4567", "+44 7700 900123", "080312345678"])("rejects %s", (input) => {
    expect(normaliseNigerianPhone(input)).toBeNull();
  });
});

describe("updateProfileSchema", () => {
  it("normalises the phone and clears empty strings", () => {
    const parsed = updateProfileSchema.parse({ phone: "0803 123 4567", bio: "", lga: "  Ikeja " });
    expect(parsed).toEqual({ phone: "+2348031234567", bio: null, lga: "Ikeja" });
  });

  it("rejects unknown fields so clients cannot set server-owned columns", () => {
    expect(updateProfileSchema.safeParse({ completenessScore: 100 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ cvPublicId: "x" }).success).toBe(false);
  });

  it("rejects a state that is not a Nigerian state", () => {
    expect(updateProfileSchema.safeParse({ stateOfResidence: "Texas" }).success).toBe(false);
  });
});

describe("cohortDateProblem", () => {
  const d = (day: number) => new Date(Date.UTC(2027, 0, day));
  const valid = {
    applicationOpensAt: d(1),
    applicationClosesAt: d(10),
    trainingStartsAt: d(10),
    trainingEndsAt: d(20),
    internshipStartsAt: d(21),
    internshipEndsAt: d(30),
  };

  it("accepts an ordered timeline (training may start the day applications close)", () => {
    expect(cohortDateProblem(valid)).toBeNull();
  });

  it("rejects applications that close before they open", () => {
    expect(cohortDateProblem({ ...valid, applicationClosesAt: d(1) })).toMatch(/open before/);
  });

  it("rejects an internship that starts during training", () => {
    expect(cohortDateProblem({ ...valid, internshipStartsAt: d(15) })).toMatch(/after training/);
  });
});
