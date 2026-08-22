import { describe, expect, it } from "vitest";
import { chartLabelLayout, wrapChartLabel } from "../src/components/SurveyChart";

describe("bar chart label wrapping", () => {
  it("wraps complete words when multiple lines are available", () => {
    expect(wrapChartLabel("Proposal review guidance materials", 18, 2)).toBe("Proposal review\nguidance materials");
  });

  it("keeps short labels unchanged", () => {
    expect(wrapChartLabel("Country office", 18, 2)).toBe("Country office");
  });

  it("uses an ellipsis when dense charts only allow one line", () => {
    expect(wrapChartLabel("Previously approved proposal materials", 20, 1)).toBe("Previously approved…");
  });
});

describe("responsive chart label density", () => {
  it("gives sparse desktop charts more width and lines than dense charts", () => {
    const sparse = chartLabelLayout(4, "desktop");
    const dense = chartLabelLayout(18, "desktop");
    expect(sparse.axisWidth).toBeGreaterThan(dense.axisWidth);
    expect(sparse.maxLines).toBeGreaterThan(dense.maxLines);
    expect(sparse.maxCharacters).toBeGreaterThan(dense.maxCharacters);
  });

  it("keeps export labels single-line while preserving a wide label column", () => {
    expect(chartLabelLayout(3, "export")).toMatchObject({ axisWidth: 340, maxLines: 1, maxCharacters: 46 });
  });
});
