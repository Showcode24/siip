import { describe, expect, it } from "vitest";
import { normaliseNigerianPhone } from "@/server/lib/nigeria";
import {
  computeCompleteness,
  missingForApplication,
  type ProfileForScoring,
} from "@/server/lib/profile-completeness";
import { cohortDateProblem } from "@/server/validators/cohort";
import { updateProfileSchema } from "@/server/validators/graduate";
import { normalisePhone } from "@siip/shared/phone";
import { isTimeZone } from "@siip/shared/timezones";
import { companyIdentityProblems, normaliseCompanyIdentity } from "@siip/shared/validators/company";
import { normaliseProfileUpdate } from "@/server/lib/profile-rules";

const empty: ProfileForScoring = {
  phone: null,
  country: null,
  city: null,
  workPreference: null,
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
  country: "NG",
  city: "Lagos",
  workPreference: "HYBRID",
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
      "Country",
      "City",
      "Work preference",
      "Institution",
      "Course of study",
      "Graduation year",
      "Availability",
      "CV (PDF)",
      "At least one skill",
    ]);
  });

  it("does not require optional fields (photo, bio, degree class)", () => {
    expect(missingForApplication({ ...full, photoUrl: null, bio: null, degreeClass: null })).toEqual([]);
  });

  it("does not count a missing degree class against undergraduates", () => {
    const noClass = { ...full, degreeClass: null };
    expect(computeCompleteness({ ...noClass, internType: "UNDERGRADUATE" })).toBe(100);
    expect(computeCompleteness({ ...noClass, internType: "GRADUATE" })).toBe(95);
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

describe("normalisePhone (any country)", () => {
  it.each([
    ["+44 7700 900123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
    ["+1 (415) 555-0132", "+14155550132"],
    ["0803 123 4567", "+2348031234567"],
  ])("normalises %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each(["12345", "+0123456789", "phone", "+1234567890123456"])("rejects %s", (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});

describe("updateProfileSchema: open registration", () => {
  it("accepts an undergraduate in another country with a work preference", () => {
    const r = updateProfileSchema.safeParse({
      internType: "UNDERGRADUATE",
      country: "GH",
      city: "Accra",
      workPreference: "REMOTE",
      phone: "+233 24 123 4567",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown country code", () => {
    expect(updateProfileSchema.safeParse({ country: "XX" }).success).toBe(false);
  });

  it("checks the NYSC state code format and upper-cases it", () => {
    expect(updateProfileSchema.parse({ nyscStateCode: "la/24a/1234" }).nyscStateCode).toBe("LA/24A/1234");
    expect(updateProfileSchema.safeParse({ nyscStateCode: "Lagos 2024" }).success).toBe(false);
  });
});

describe("normaliseProfileUpdate", () => {
  const ng = { country: "NG", internType: "NYSC_CORPS_MEMBER" };

  it("clears Nigerian state and LGA when the intern is outside Nigeria", () => {
    const out = normaliseProfileUpdate(ng, { country: "KE", stateOfResidence: "Lagos", lga: "Ikeja" });
    expect(out.stateOfResidence).toBeNull();
    expect(out.lga).toBeNull();
  });

  it("keeps Nigerian state for interns in Nigeria", () => {
    expect(normaliseProfileUpdate(ng, { stateOfResidence: "Lagos" }).stateOfResidence).toBe("Lagos");
  });

  it("marks corps members as serving", () => {
    expect(normaliseProfileUpdate({ country: "NG", internType: "GRADUATE" }, { internType: "NYSC_CORPS_MEMBER" }).nyscStatus).toBe("SERVING");
  });

  it("drops NYSC details for anyone who is not a corps member", () => {
    const out = normaliseProfileUpdate(ng, { internType: "UNDERGRADUATE", nyscStateCode: "LA/24A/1234", currentPpa: "X" });
    expect(out.nyscStateCode).toBeNull();
    expect(out.currentPpa).toBeNull();
    expect(out.nyscStatus).toBe("COMPLETED");
  });
});

describe("company registration by country", () => {
  it("asks Nigerian companies for a CAC number and state", () => {
    expect(companyIdentityProblems({ country: "NG" }).map((p) => p.path)).toEqual(["rcNumber", "state"]);
    expect(companyIdentityProblems({ country: "NG", rcNumber: "RC1", state: "Lagos" })).toEqual([]);
  });

  it("asks other companies for a registration number instead", () => {
    expect(companyIdentityProblems({ country: "GB" }).map((p) => p.path)).toEqual(["businessRegNumber"]);
    expect(companyIdentityProblems({ country: "GB", businessRegNumber: "12345678" })).toEqual([]);
  });

  it("drops details that don't apply to the country", () => {
    expect(normaliseCompanyIdentity({ country: "GB", rcNumber: "RC1", state: "Lagos", businessRegNumber: "1" }))
      .toEqual({ country: "GB", rcNumber: null, state: null, businessRegNumber: "1" });
  });

  it("knows real time zones", () => {
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Africa/Lagos")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
  });
});
