import { describe, expect, it } from "vitest";
import { wrapChartLabel } from "../src/components/SurveyChart";

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
