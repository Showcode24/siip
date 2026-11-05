import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/server/lib/csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Lagos, "Island"')).toBe('"Lagos, ""Island"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+234803")).toBe("'+234803");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("formats empties and dates, and starts with a BOM", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2027-01-02T00:00:00Z"))).toBe("2027-01-02T00:00:00.000Z");
    expect(toCsv(["a"], [[1]])).toBe("﻿a\r\n1\r\n");
  });
});
