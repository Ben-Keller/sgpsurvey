import type { Analysis, Answer, Question, Respondent } from "../types";

const SCORE_MAP: Record<string, number> = {
  never: 1,
  rarely: 2,
  sometimes: 3,
  frequently: 4,
  "not important": 1,
  "moderately valuable": 2,
  valuable: 3,
  "highly valuable": 4,
  "moderately important": 2,
  important: 3,
  "very important": 4
};

export function answerHasValue(answer: Answer | undefined, pattern: RegExp): boolean {
  if (!answer) return false;
  if (answer.kind === "single") return Boolean(answer.value && pattern.test(answer.value));
  if (answer.kind === "multi") return answer.values.some((value) => pattern.test(value));
  if (answer.kind === "matrix") return Object.entries(answer.values).some(([item, value]) => pattern.test(item) && Boolean(value));
  return Boolean(answer.value && pattern.test(answer.value));
}

export function isEligible(respondent: Respondent, question: Question): boolean {
  if (question.eligibility.mode !== "branch" || !question.eligibility.basedOn) return true;
  const source = respondent.answers[question.eligibility.basedOn];
  switch (question.eligibility.rule) {
    case "other_selected":
      return answerHasValue(source, /other/i);
    case "revision_requested":
      return !answerHasValue(source, /^no\b/i) && answerHasValue(source, /yes|requested/i);
    case "activities_changed":
      return answerHasValue(source, /yes|minor|major|change/i) && !answerHasValue(source, /^no\b/i);
    case "has_implementation_experience":
      return !answerHasValue(source, /^no\b|not yet|none/i);
    default:
      return true;
  }
}

export function filterRespondents(
  respondents: Respondent[],
  filters: Record<string, string[]>
): Respondent[] {
  return respondents.filter((respondent) =>
    Object.entries(filters).every(([key, selected]) => {
      if (!selected.length) return true;
      const value = respondent.dimensions[key];
      const values = Array.isArray(value) ? value : value ? [value] : [];
      return selected.some((selection) => values.includes(selection));
    })
  );
}

export function analyzeQuestion(
  respondents: Respondent[],
  question: Question,
  suppressionThreshold = 0
): Analysis {
  const eligible = respondents.filter((respondent) => isEligible(respondent, question));
  const suppressed = suppressionThreshold > 0 && respondents.length < suppressionThreshold;
  let validResponses = 0;
  let totalSelections = 0;
  const counts = new Map<string, number>();
  const matrixValues = new Map<string, { scores: number[]; distribution: Map<string, number> }>();

  for (const respondent of eligible) {
    const answer = respondent.answers[question.id];
    if (!answer) continue;
    if (answer.kind === "single" && answer.value) {
      validResponses++;
      counts.set(answer.value, (counts.get(answer.value) ?? 0) + 1);
    } else if (answer.kind === "multi" && answer.values.length) {
      validResponses++;
      totalSelections += answer.values.length;
      answer.values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    } else if (answer.kind === "text" && answer.value) {
      validResponses++;
    } else if (answer.kind === "matrix") {
      let rowValid = false;
      Object.entries(answer.values).forEach(([item, value]) => {
        if (!value) return;
        rowValid = true;
        const record = matrixValues.get(item) ?? { scores: [], distribution: new Map<string, number>() };
        record.distribution.set(value, (record.distribution.get(value) ?? 0) + 1);
        const score = SCORE_MAP[value.toLowerCase()];
        if (score) record.scores.push(score);
        matrixValues.set(item, record);
      });
      if (rowValid) validResponses++;
    }
  }

  const categories = [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: validResponses ? (count / validResponses) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const matrix = question.matrixItems.map((label) => {
    const record = matrixValues.get(label) ?? { scores: [], distribution: new Map<string, number>() };
    const mean = record.scores.length ? record.scores.reduce((sum, score) => sum + score, 0) / record.scores.length : null;
    return {
      label,
      count: record.scores.length,
      mean,
      normalized: mean === null ? null : ((mean - 1) / 3) * 100,
      distribution: Object.fromEntries(record.distribution)
    };
  });

  return {
    filteredBase: respondents.length,
    eligibleBase: eligible.length,
    validResponses,
    blankResponses: Math.max(0, eligible.length - validResponses),
    totalSelections,
    categories: suppressed ? [] : categories,
    matrix: suppressed ? [] : matrix,
    suppressed
  };
}

export function optionOrder(question: Question, categories: Analysis["categories"]) {
  if (question.kind !== "ordinal_choice") return categories;
  const rank = (label: string) => {
    const v = label.toLowerCase();
    if (/none|never|not at all|unreliable|less than one|^no\b/.test(v)) return 0;
    if (/rarely|occasionally|somewhat|1[- ]?2|^1$/.test(v)) return 1;
    if (/sometimes|mostly|2[- ]?3|3 to 5|3-5/.test(v)) return 2;
    if (/frequent|clear|reliable|very|more than|>10|yes/.test(v)) return 3;
    if (/not applicable|unsure|don't know|not sure/.test(v)) return 9;
    return 5;
  };
  return [...categories].sort((a, b) => rank(a.label) - rank(b.label));
}
