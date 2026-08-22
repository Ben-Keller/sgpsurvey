import { describe, expect, it } from "vitest";
import { makeChartOption } from "../src/components/SurveyChart";
import type { Analysis, Question } from "../src/types";

const question: Question = {
  id: "group.q1",
  number: 1,
  section: "Test",
  prompt: "Test?",
  kind: "multi_select",
  responseCountUnfiltered: 28,
  eligibility: { mode: "all_respondents_in_tab" },
  chart: { default: "treemap", alternatives: [] },
  sourceColumns: [],
  matrixItems: [],
  display: {}
};

const analysis: Analysis = {
  filteredBase: 28,
  eligibleBase: 28,
  validResponses: 28,
  blankResponses: 0,
  totalSelections: 39,
  categories: [
    { label: "English", count: 24, percent: 85.7142857 },
    { label: "French", count: 15, percent: 53.5714286 }
  ],
  matrix: [],
  suppressed: false
};

describe("treemap tooltip data", () => {
  it("uses metadata on the hovered node rather than ECharts' internal data index", () => {
    const option = makeChartOption(question, analysis, "treemap", "country_team", 0) as any;
    const frenchNode = option.series[0].data[1];
    const tooltip = option.tooltip.formatter({ data: frenchNode, dataIndex: 0 });

    expect(tooltip).toContain("<strong>French</strong>");
    expect(tooltip).toContain("15 of 28 responses");
    expect(tooltip).toContain("53.6%");
    expect(tooltip).not.toContain("English");
  });
});
