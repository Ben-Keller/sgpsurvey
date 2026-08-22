import type { ChartType, Question } from "../types";

const hiddenChartTypes = new Set<ChartType>(["diverging_bar", "lollipop"]);

export function availableChartTypes(question: Question, categoryCount?: number) {
  const charts = [question.chart.default, ...question.chart.alternatives].filter((chart) => !hiddenChartTypes.has(chart));
  return categoryCount !== undefined && categoryCount > 7 ? charts.filter((chart) => chart !== "donut") : charts;
}
