import { describe, expect, it } from "vitest";
import { PDF_SUMMARY_INTRO, pdfChartPixelHeight } from "../src/lib/pdfExport";

describe("summary PDF introduction", () => {
  it("uses the full platform and methodology context in three paragraphs", () => {
    expect(PDF_SUMMARY_INTRO.split("\n\n")).toHaveLength(3);
    expect(PDF_SUMMARY_INTRO).toContain("To support the development of the SGP Knowledge and Learning Platform");
    expect(PDF_SUMMARY_INTRO).toContain("jointly developed by UNDP, FAO, and Conservation International (CI)");
    expect(PDF_SUMMARY_INTRO).toContain("This survey methodology covered four stakeholder groups");
    expect(PDF_SUMMARY_INTRO).not.toContain("Complete results across all stakeholder tabs");
  });
});

describe("summary PDF chart sizing", () => {
  it("keeps short bar charts compact and caps dense charts", () => {
    expect(pdfChartPixelHeight("ranked_bar", 2)).toBe(220);
    expect(pdfChartPixelHeight("ranked_bar", 8)).toBe(462);
    expect(pdfChartPixelHeight("ranked_bar", 20)).toBe(650);
  });

  it("uses a consistent fixed canvas for non-axis charts", () => {
    expect(pdfChartPixelHeight("donut", 2)).toBe(620);
    expect(pdfChartPixelHeight("treemap", 15)).toBe(620);
  });
});
