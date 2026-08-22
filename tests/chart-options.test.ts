import { describe, expect, it } from "vitest";
import { categoryIndexAtPoint, makeChartOption, nearestRadarPoint, positionChartTooltip } from "../src/components/SurveyChart";
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

describe("mobile chart tooltip placement", () => {
  it("keeps tooltips inside narrow chart viewports and flips them above near the bottom", () => {
    expect(positionChartTooltip([310, 420], { contentSize: [180, 90], viewSize: [320, 460] })).toEqual([132, 318]);
    expect(positionChartTooltip([2, 4], { contentSize: [180, 90], viewSize: [320, 460] })).toEqual([14, 16]);
  });

  it("anchors item tooltips to the rendered mark rectangle rather than an unreliable pointer", () => {
    const position = positionChartTooltip(
      [0, 0],
      {},
      undefined,
      { x: 110, y: 80, width: 140, height: 24 },
      { contentSize: [150, 70], viewSize: [420, 260] }
    );
    expect(position).toEqual([262, 104]);
  });

  it("applies confined, wrapping tooltip styling to treemaps", () => {
    const option = makeChartOption(question, analysis, "treemap", "country_team", 0) as any;
    expect(option.tooltip.confine).toBe(true);
    expect(option.tooltip.triggerOn).toContain("click");
    expect(option.tooltip.extraCssText).toContain("white-space:normal");
    expect(option.tooltip.textStyle.fontSize).toBe(13);
    expect(option.tooltip.className).toBe("survey-chart-tooltip");
  });
});

describe("radar point hit testing", () => {
  it("uses the nearest real plotted point and respects the hit threshold", () => {
    const points = [{ index: 0, point: [100, 80] as [number, number] }, { index: 1, point: [142, 112] as [number, number] }];
    expect(nearestRadarPoint([104, 83], points, 12)?.index).toBe(0);
    expect(nearestRadarPoint([130, 103], points, 20)?.index).toBe(1);
    expect(nearestRadarPoint([200, 200], points, 20)).toBeNull();
  });
});

describe("mobile bar row hit testing", () => {
  it("resolves the tapped category across the full rendered row", () => {
    const grid = { y: 16, height: 400 };
    expect(categoryIndexAtPoint(32, grid, 8)).toBe(0);
    expect(categoryIndexAtPoint(220, grid, 8)).toBe(4);
    expect(categoryIndexAtPoint(10, grid, 8)).toBeNull();
    expect(categoryIndexAtPoint(430, grid, 8)).toBeNull();
  });
});

describe("radar tooltip behavior", () => {
  it("disables the generic ECharts tooltip so only the detailed custom tooltip appears", () => {
    const radarAnalysis = { ...analysis, categories: [], matrix: [{ label: "Guidance quality", count: 20, mean: 3, normalized: 66.7, distribution: {} }] };
    const option = makeChartOption(question, radarAnalysis, "radar", "country_team", 0) as any;
    expect(option.tooltip).toMatchObject({ show: false, triggerOn: "none" });
  });
});
