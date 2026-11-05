import { describe, expect, it } from "vitest";
import { renderCertificatePdf } from "@/server/pdf/certificate";
import { internshipMonth } from "@/server/services/internship.service";

const d = (iso: string) => new Date(`${iso}T09:00:00Z`);

describe("internshipMonth", () => {
  it("counts months from the start date and caps at 3", () => {
    expect(internshipMonth(d("2027-01-15"), d("2027-01-10"))).toBe(0);
    expect(internshipMonth(d("2027-01-15"), d("2027-01-15"))).toBe(1);
    expect(internshipMonth(d("2027-01-15"), d("2027-02-14"))).toBe(1);
    expect(internshipMonth(d("2027-01-15"), d("2027-02-15"))).toBe(2);
    expect(internshipMonth(d("2027-01-15"), d("2027-03-20"))).toBe(3);
    expect(internshipMonth(d("2027-01-15"), d("2027-09-01"))).toBe(3);
  });
});

describe("renderCertificatePdf", () => {
  it("produces a PDF", async () => {
    const pdf = await renderCertificatePdf({
      graduateName: "Ada Obi",
      cohortName: "Cohort 1",
      companyName: "Acme",
      roleTitle: "Content Intern",
      startDate: "1 January 2027",
      endDate: "1 April 2027",
      issueDate: "2 April 2027",
      serialNumber: "SIIP-2027-ABCDEFGH",
      verificationCode: "ABCDE-FGHJK",
      verifyUrl: "https://siip.ng/verify?code=ABCDE-FGHJK",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
