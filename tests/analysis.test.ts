import { describe, expect, it } from "vitest";
import { analyzeQuestion, filterRespondents, isEligible } from "../src/lib/analysis";
import type { Question, Respondent } from "../src/types";

const baseQuestion: Question = {
  id: "group.q1", number: 1, section: "Test", prompt: "Test?", kind: "multi_select",
  responseCountUnfiltered: 3, eligibility: { mode: "all_respondents_in_tab" },
  chart: { default: "ranked_bar", alternatives: ["data_table"] }, sourceColumns: [], matrixItems: [], display: {}
};

const respondents: Respondent[] = [
  { id: "1", stakeholder: "group", dimensions: { language: "English", country: "Togo" }, answers: { "group.q1": { kind: "multi", values: ["A", "B"] } } },
  { id: "2", stakeholder: "group", dimensions: { language: "French", country: "Togo" }, answers: { "group.q1": { kind: "multi", values: ["A"] } } },
  { id: "3", stakeholder: "group", dimensions: { language: "English", country: "Benin" }, answers: { "group.q1": { kind: "multi", values: [] } } }
];

describe("survey analysis", () => {
  it("uses valid respondents, not selections, as the multi-select denominator", () => {
    const result = analyzeQuestion(respondents, baseQuestion);
    expect(result.validResponses).toBe(2);
    expect(result.totalSelections).toBe(3);
    expect(result.categories.find((item) => item.label === "A")?.percent).toBe(100);
    expect(result.categories.find((item) => item.label === "B")?.percent).toBe(50);
  });

  it("combines dimensions with AND and selected values within a dimension with OR", () => {
    expect(filterRespondents(respondents, { language: ["English", "French"], country: ["Togo"] })).toHaveLength(2);
  });

  it("suppresses the full analysis below the public threshold", () => {
    const result = analyzeQuestion(respondents.slice(0, 2), baseQuestion, 5);
    expect(result.suppressed).toBe(true);
    expect(result.categories).toEqual([]);
  });

  it("distinguishes branch eligibility from blanks", () => {
    const question = { ...baseQuestion, eligibility: { mode: "branch", basedOn: "group.q0", rule: "revision_requested" } };
    const respondent = { ...respondents[0], answers: { ...respondents[0].answers, "group.q0": { kind: "single", value: "No revisions" } as const } };
    expect(isEligible(respondent, question)).toBe(false);
  });
});

describe("matrix scoring", () => {
  it("excludes unscored values from means but keeps their distribution", () => {
    const question = { ...baseQuestion, id: "group.q2", kind: "matrix_rating", matrixItems: ["Item"] };
    const rows: Respondent[] = [
      { ...respondents[0], answers: { "group.q2": { kind: "matrix", values: { Item: "Highly valuable" } } } },
      { ...respondents[1], answers: { "group.q2": { kind: "matrix", values: { Item: "Not important" } } } },
      { ...respondents[2], answers: { "group.q2": { kind: "matrix", values: { Item: "I don’t know" } } } }
    ];
    const result = analyzeQuestion(rows, question);
    expect(result.matrix[0].mean).toBe(2.5);
    expect(result.matrix[0].normalized).toBe(50);
    expect(result.matrix[0].distribution["I don’t know"]).toBe(1);
  });
});
