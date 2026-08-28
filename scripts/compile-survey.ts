import path from "node:path";
import readXlsxFile from "read-excel-file/node";
import {
  cleanText,
  Manifest,
  ManifestGroup,
  ManifestQuestion,
  normalizedKey,
  readJson,
  root,
  slugForGroup,
  writeJson
} from "./lib";

type AliasConfig = {
  global: Record<string, string>;
  matrix: Record<string, string>;
  knownCompoundOptions: string[];
  languageAliases: Record<string, string>;
};

type QuestionOptionSpec = {
  type: "single" | "multi";
  options: string[];
  allowOther: boolean;
  expectedCounts: Record<string, number>;
  base: number;
};

type QuestionOptionConfig = Record<string, QuestionOptionSpec>;
type QuestionAliasConfig = Record<string, Record<string, string>>;

type Answer =
  | { kind: "single"; value: string | null }
  | { kind: "multi"; values: string[]; rawUnclassified?: string[] }
  | { kind: "matrix"; values: Record<string, string | null> }
  | { kind: "text"; value: string | null; approved: boolean };

type PublicRespondent = {
  id: string;
  stakeholder: string;
  dimensions: Record<string, string | string[] | null>;
  answers: Record<string, Answer>;
};

const manifest = readJson<Manifest>("question-manifest.json");
const aliases = readJson<AliasConfig>("data/config/aliases.json");
const questionOptions = readJson<QuestionOptionConfig>("data/config/question-options.json");
const questionAliases = readJson<QuestionAliasConfig>("data/config/question-aliases.json");
const workbookPath = path.join(root, "data/source/GEF_SGP_Survey_Responses_English.xlsx");

const aliasUsage = new Map<string, number>();
const unmatchedMatrix = new Map<string, number>();
const matrixCompositeExclusions = new Map<string, number>();
const categories = new Map<string, Map<string, number>>();
const optionValidation: Record<string, { base: number; other: number; categoryCounts: Record<string, number> }> = {};
const publicModeK = Number(process.env.PUBLIC_K ?? 5);
const questionTypeLabels: Record<string, string> = {
  dimension: "Dimension",
  single_choice: "Single choice",
  ordinal_choice: "Ordinal choice",
  language_need: "Language need",
  multi_select: "Multi-select",
  matrix_frequency: "Matrix frequency",
  matrix_rating: "Matrix rating",
  qualitative: "Qualitative"
};

function expectedQuestionTypeRow(group: ManifestGroup, columnCount: number): string[] {
  const expected = Array<string>(columnCount).fill("");
  expected[0] = "Timestamp";
  expected[1] = "Response language";
  for (const question of group.questions) {
    const label = questionTypeLabels[question.kind];
    if (!label) throw new Error(`${question.id}: unsupported question kind ${question.kind}.`);
    for (const source of question.sourceColumns) expected[source.index] = label;
  }
  const missing = expected.flatMap((label, index) => label ? [] : [index]);
  if (missing.length) throw new Error(`${group.sourceSheet}: question type mapping is missing columns ${missing.join(", ")}.`);
  return expected;
}

function choiceKey(value: unknown, preserveDelimiters = false): string {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  let normalized = cleaned
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replaceAll("&", " and ")
    .replaceAll("programme", "program")
    .replaceAll("adviser", "advisor")
    .replaceAll("telephone", "phone");
  if (preserveDelimiters) normalized = normalized.replace(/[,;\n•]+/g, " | ").replace(/[^a-z0-9|]+/g, " ");
  else normalized = normalized.replace(/[^a-z0-9]+/g, " ");
  return normalized.replace(/\s+/g, " ").trim();
}

function containsChoice(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

function canonicalize(value: unknown, matrix = false): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const key = normalizedKey(cleaned);
  const mapped = (matrix ? aliases.matrix[key] : undefined) ?? aliases.global[key];
  if (mapped && mapped !== cleaned) aliasUsage.set(`${cleaned} → ${mapped}`, (aliasUsage.get(`${cleaned} → ${mapped}`) ?? 0) + 1);
  return mapped ?? cleaned.replace(/[.。]+$/u, "").trim();
}

function parseLanguages(value: unknown): { values: string[]; unclassified: string[] } {
  const cleaned = cleanText(value);
  if (!cleaned) return { values: [], unclassified: [] };
  const found: string[] = [];
  let remainder = cleaned.toLowerCase();
  for (const [alias, label] of Object.entries(aliases.languageAliases).sort((a, b) => b[0].length - a[0].length)) {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (pattern.test(remainder)) {
      found.push(label);
      remainder = remainder.replace(pattern, " ");
    }
  }
  remainder = remainder.replace(/\b(and|or|et|y|ou|und|и)\b|[,&/;+]|\s+/gi, " ").trim();
  return { values: [...new Set(found)], unclassified: remainder ? [remainder] : [] };
}

function parseMulti(value: unknown): { values: string[]; unclassified: string[] } {
  const cleaned = cleanText(value);
  if (!cleaned) return { values: [], unclassified: [] };
  let protectedText = cleaned;
  const protectedValues: string[] = [];
  for (const option of [...aliases.knownCompoundOptions].sort((a, b) => b.length - a.length)) {
    const start = protectedText.toLowerCase().indexOf(option.toLowerCase());
    if (start >= 0) {
      const token = `§${protectedValues.length}§`;
      protectedValues.push(protectedText.slice(start, start + option.length));
      protectedText = `${protectedText.slice(0, start)}${token}${protectedText.slice(start + option.length)}`;
    }
  }
  const values = protectedText
    .split(/\s*(?:,|;|\n|\u2022)\s*/)
    .map((part) => part.replace(/§(\d+)§/g, (_, index) => protectedValues[Number(index)]))
    .map((part) => canonicalize(part))
    .filter((part): part is string => Boolean(part));
  return { values: [...new Set(values)], unclassified: [] };
}

function recordCategory(questionId: string, values: (string | null)[]) {
  const counter = categories.get(questionId) ?? new Map<string, number>();
  values.filter((v): v is string => Boolean(v)).forEach((v) => counter.set(v, (counter.get(v) ?? 0) + 1));
  categories.set(questionId, counter);
}

function parseOptionQuestion(question: ManifestQuestion, rows: unknown[][], spec: QuestionOptionSpec): Answer[] {
  const preserveDelimiters = spec.type === "multi";
  const keyFor = (value: unknown) => choiceKey(value, preserveDelimiters);
  const aliasMap = new Map<string, string>();
  spec.options.forEach((option) => aliasMap.set(keyFor(option), option));
  Object.entries(questionAliases[question.id] ?? {}).forEach(([alias, option]) => aliasMap.set(keyFor(alias), option));
  const aliasEntries = [...aliasMap].sort((a, b) => b[0].length - a[0].length);
  const sourceIndex = question.sourceColumns[0].index;

  const parsed = rows.map((row) => {
    const raw = cleanText(row[sourceIndex]);
    const normalized = keyFor(raw);
    const selected = new Set<string>();
    if (normalized) {
      if (spec.type === "single") {
        const option = aliasMap.get(normalized);
        if (option) selected.add(option);
      } else {
        aliasEntries.forEach(([alias, option]) => {
          if (alias && containsChoice(normalized, alias)) selected.add(option);
        });
      }
    }
    const fixed = spec.options.filter((option) => selected.has(option));
    let remainder = ` ${normalized} `;
    aliasEntries.forEach(([alias, option]) => {
      if (fixed.includes(option)) remainder = remainder.replaceAll(` ${alias} `, " ");
    });
    remainder = remainder
      .replaceAll("|", " ")
      .replace(/\b(and|or|et|y|ou|und|i|na|n a)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { raw, fixed, remainder };
  });

  const answers: Answer[] = parsed.map((item) => {
    const hasOther = Boolean(item.raw) && (spec.type === "single" ? item.fixed.length === 0 : Boolean(item.remainder));
    if (hasOther && !spec.allowOther) {
      throw new Error(`${question.id}: response contains text outside the configured survey options: ${item.raw}`);
    }
    if (spec.type === "single") {
      const value = item.fixed[0] ?? (hasOther ? "Other (free text)" : null);
      recordCategory(question.id, [value]);
      return { kind: "single", value };
    }
    const values = [...item.fixed, ...(hasOther ? ["Other (free text)"] : [])];
    recordCategory(question.id, values);
    return {
      kind: "multi",
      values,
      ...(hasOther && item.raw ? { rawUnclassified: [item.raw] } : {})
    };
  });

  const actualCounts = new Map<string, number>();
  answers.forEach((answer) => {
    const values = answer.kind === "single" ? [answer.value] : answer.kind === "multi" ? answer.values : [];
    values.filter((value): value is string => Boolean(value)).forEach((value) => actualCounts.set(value, (actualCounts.get(value) ?? 0) + 1));
  });
  const actualBase = answers.filter((answer) => answer.kind === "single" ? Boolean(answer.value) : answer.kind === "multi" && answer.values.length > 0).length;
  const mismatches = Object.entries(spec.expectedCounts).filter(([option, expected]) => (actualCounts.get(option) ?? 0) !== expected);
  if (actualBase !== spec.base || mismatches.length) {
    const countSummary = mismatches.map(([option, expected]) => `${option}: ${actualCounts.get(option) ?? 0}/${expected}`).join(", ");
    throw new Error(`${question.id}: refined option validation failed (base ${actualBase}/${spec.base}${countSummary ? `; ${countSummary}` : ""}).`);
  }
  optionValidation[question.id] = {
    base: actualBase,
    other: actualCounts.get("Other (free text)") ?? 0,
    categoryCounts: Object.fromEntries(spec.options.concat(spec.allowOther ? ["Other (free text)"] : []).map((option) => [option, actualCounts.get(option) ?? 0]))
  };
  return answers;
}

function parseAnswer(question: ManifestQuestion, row: unknown[]): Answer {
  if (question.kind.startsWith("matrix_")) {
    const values: Record<string, string | null> = {};
    question.sourceColumns.forEach((source, index) => {
      const raw = cleanText(row[source.index]);
      const isComposite = Boolean(raw?.includes(","));
      const value = isComposite ? null : canonicalize(raw, true);
      const item = question.matrixItems[index] ?? source.header.match(/\[([^\]]+)\]\s*$/)?.[1] ?? `Item ${index + 1}`;
      values[item] = value;
      if (isComposite && raw) matrixCompositeExclusions.set(`${question.id}: ${raw}`, (matrixCompositeExclusions.get(`${question.id}: ${raw}`) ?? 0) + 1);
      if (value && !Object.values(aliases.matrix).includes(value)) {
        unmatchedMatrix.set(`${question.id}: ${value}`, (unmatchedMatrix.get(`${question.id}: ${value}`) ?? 0) + 1);
      }
    });
    recordCategory(question.id, Object.values(values));
    return { kind: "matrix", values };
  }

  const raw = row[question.sourceColumns[0].index];
  if (question.kind === "qualitative") {
    const value = cleanText(raw);
    return { kind: "text", value, approved: Boolean(value) };
  }
  if (question.kind === "multi_select" || question.kind === "language_need") {
    const parsed = question.kind === "language_need" ? parseLanguages(raw) : parseMulti(raw);
    recordCategory(question.id, parsed.values);
    return { kind: "multi", values: parsed.values, ...(parsed.unclassified.length ? { rawUnclassified: parsed.unclassified } : {}) };
  }
  const value = canonicalize(raw);
  recordCategory(question.id, [value]);
  return { kind: "single", value };
}

function buildDimensions(group: ManifestGroup, answers: Record<string, Answer>, language: string | null) {
  const dimensions: Record<string, string | string[] | null> = { response_language: canonicalize(language) };
  for (const filter of group.filters) {
    if (filter.key === "response_language") continue;
    const answer = answers[filter.source];
    dimensions[filter.key] = answer?.kind === "single" ? answer.value : answer?.kind === "multi" ? answer.values : null;
  }
  return dimensions;
}

function answerHasValue(answer: Answer): boolean {
  if (answer.kind === "single" || answer.kind === "text") return Boolean(answer.value);
  if (answer.kind === "multi") return answer.values.length > 0;
  return Object.values(answer.values).some(Boolean);
}

const summaries: unknown[] = [];
for (const group of manifest.groups) {
  const workbookResult = await readXlsxFile(workbookPath) as unknown as Array<{ sheet?: string; data?: unknown[][] }> | unknown[][];
  const sheetRows = Array.isArray(workbookResult) && workbookResult.length > 0 && !Array.isArray(workbookResult[0])
    ? (workbookResult as Array<{ sheet?: string; data?: unknown[][] }>).find((result) => result.sheet === group.sourceSheet)?.data ?? []
    : workbookResult as unknown[][];
  if (!sheetRows.length) throw new Error(`Missing or empty worksheet: ${group.sourceSheet}`);
  const headers = sheetRows[0].map((v) => cleanText(v));
  const headerErrors: string[] = [];
  if (headers[0] !== "Timestamp") headerErrors.push("metadata column 0");
  if (headers[1] !== "Original response language") headerErrors.push("metadata column 1");
  for (const question of group.questions) {
    for (const source of question.sourceColumns) {
      if (headers[source.index] !== cleanText(source.header)) headerErrors.push(`${question.id} column ${source.index}`);
    }
  }
  if (headerErrors.length) throw new Error(`Header mismatch: ${headerErrors.join(", ")}`);

  const expectedTypes = expectedQuestionTypeRow(group, headers.length);
  const actualTypes = (sheetRows[1] ?? []).map((value) => cleanText(value));
  const typeErrors = expectedTypes.flatMap((expected, index) => actualTypes[index] === expected ? [] : [`column ${index} (${actualTypes[index] || "blank"} ≠ ${expected})`]);
  if (typeErrors.length) throw new Error(`${group.sourceSheet}: question type row mismatch: ${typeErrors.join(", ")}`);

  const dataRows = sheetRows.slice(2).filter((row) => row.some((value) => cleanText(value)));
  const answersByQuestion = new Map<string, Answer[]>();
  group.questions.forEach((question) => {
    const spec = questionOptions[question.id];
    answersByQuestion.set(question.id, spec ? parseOptionQuestion(question, dataRows, spec) : dataRows.map((row) => parseAnswer(question, row)));
  });

  const internal: PublicRespondent[] = [];
  const publicRows: PublicRespondent[] = [];
  dataRows.forEach((row, index) => {
    const answers: Record<string, Answer> = {};
    group.questions.forEach((question) => {
      const answer = answersByQuestion.get(question.id)?.[index];
      if (!answer) throw new Error(`${question.id}: missing parsed answer for row ${index + 3}.`);
      answers[question.id] = answer;
    });
    const base: PublicRespondent = {
      id: `${group.key}-${String(index + 1).padStart(3, "0")}`,
      stakeholder: group.key,
      dimensions: buildDimensions(group, answers, cleanText(row[1])),
      answers
    };
    internal.push(base);
    publicRows.push({ ...base, answers });
  });

  const expected = group.respondentCount;
  group.respondentCount = internal.length;
  group.questions.forEach((question) => {
    question.responseCountUnfiltered = (answersByQuestion.get(question.id) ?? []).filter(answerHasValue).length;
  });

  const slug = slugForGroup(group.key);
  writeJson(`public/data/internal/${slug}.json`, { schemaVersion: manifest.schemaVersion, mode: "internal", group: group.key, respondents: internal });
  writeJson(`public/data/public/${slug}.json`, { schemaVersion: manifest.schemaVersion, mode: "public", suppressionThreshold: publicModeK, group: group.key, respondents: publicRows });
  summaries.push({ group: group.key, expected, compiled: internal.length });
}

manifest.totalRespondents = manifest.groups.reduce((total, group) => total + group.respondentCount, 0);
(manifest as Manifest & { sourceFile?: string }).sourceFile = path.basename(workbookPath);
writeJson("public/data/manifest.json", manifest);
writeJson("data/config/question-manifest.json", manifest);
writeJson("question-manifest.json", manifest);
writeJson("data/qa/normalization-report.json", {
  generatedAt: new Date().toISOString(),
  sourceWorkbook: path.basename(workbookPath),
  sourceWorkbookMetadata: {
    headerRow: 1,
    questionTypeRow: 2,
    responseStartRow: 3,
    questionTypeLabels
  },
  schemaVersion: manifest.schemaVersion,
  respondentReconciliation: summaries,
  questionCount: manifest.groups.flatMap((g) => g.questions).length,
  aliasUsage: Object.fromEntries([...aliasUsage].sort()),
  unmatchedMatrixValues: Object.fromEntries([...unmatchedMatrix].sort()),
  excludedCompositeMatrixValues: Object.fromEntries([...matrixCompositeExclusions].sort()),
  materialUnmatchedThreshold: 5,
  refinedOptionValidation: optionValidation,
  canonicalCategories: Object.fromEntries(
    [...categories].map(([id, values]) => [id, Object.fromEntries([...values].sort((a, b) => b[1] - a[1]))])
  ),
  privacy: {
    timestampsIncluded: false,
    publicQualitativePolicy: "all_source_responses_approved_for_publication",
    publicSuppressionThreshold: publicModeK
  }
});

console.log(`Compiled ${manifest.totalRespondents} responses across ${manifest.groups.length} stakeholder groups.`);
