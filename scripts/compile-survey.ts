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
const workbookPath = path.join(root, "data/source/GEF_SGP_Survey_Responses_English.xlsx");

const aliasUsage = new Map<string, number>();
const unmatchedMatrix = new Map<string, number>();
const categories = new Map<string, Map<string, number>>();
const publicModeK = Number(process.env.PUBLIC_K ?? 5);

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

function parseAnswer(question: ManifestQuestion, row: unknown[]): Answer {
  if (question.kind.startsWith("matrix_")) {
    const values: Record<string, string | null> = {};
    question.sourceColumns.forEach((source, index) => {
      const value = canonicalize(row[source.index], true);
      const item = question.matrixItems[index] ?? source.header.match(/\[([^\]]+)\]\s*$/)?.[1] ?? `Item ${index + 1}`;
      values[item] = value;
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

const summaries: unknown[] = [];
for (const group of manifest.groups) {
  const workbookResult = await readXlsxFile(workbookPath) as unknown as Array<{ sheet?: string; data?: unknown[][] }> | unknown[][];
  const sheetRows = Array.isArray(workbookResult) && workbookResult.length > 0 && !Array.isArray(workbookResult[0])
    ? (workbookResult as Array<{ sheet?: string; data?: unknown[][] }>).find((result) => result.sheet === group.sourceSheet)?.data ?? []
    : workbookResult as unknown[][];
  if (!sheetRows.length) throw new Error(`Missing or empty worksheet: ${group.sourceSheet}`);
  const headers = sheetRows[0].map((v) => cleanText(v));
  const headerErrors: string[] = [];
  for (const question of group.questions) {
    for (const source of question.sourceColumns) {
      if (headers[source.index] !== cleanText(source.header)) headerErrors.push(`${question.id} column ${source.index}`);
    }
  }
  if (headerErrors.length) throw new Error(`Header mismatch: ${headerErrors.join(", ")}`);

  const internal: PublicRespondent[] = [];
  const publicRows: PublicRespondent[] = [];
  sheetRows.slice(1).forEach((row, index) => {
    if (!row.some((value) => cleanText(value))) return;
    const answers: Record<string, Answer> = {};
    group.questions.forEach((question) => (answers[question.id] = parseAnswer(question, row)));
    const base: PublicRespondent = {
      id: `${group.key}-${String(index + 1).padStart(3, "0")}`,
      stakeholder: group.key,
      dimensions: buildDimensions(group, answers, cleanText(row[1])),
      answers
    };
    internal.push(base);
    publicRows.push({ ...base, answers });
  });

  const slug = slugForGroup(group.key);
  writeJson(`public/data/internal/${slug}.json`, { schemaVersion: manifest.schemaVersion, mode: "internal", group: group.key, respondents: internal });
  writeJson(`public/data/public/${slug}.json`, { schemaVersion: manifest.schemaVersion, mode: "public", suppressionThreshold: publicModeK, group: group.key, respondents: publicRows });
  summaries.push({ group: group.key, expected: group.respondentCount, compiled: internal.length });
}

writeJson("public/data/manifest.json", manifest);
writeJson("data/config/question-manifest.json", manifest);
writeJson("data/qa/normalization-report.json", {
  generatedAt: new Date().toISOString(),
  sourceWorkbook: path.basename(workbookPath),
  schemaVersion: manifest.schemaVersion,
  respondentReconciliation: summaries,
  questionCount: manifest.groups.flatMap((g) => g.questions).length,
  aliasUsage: Object.fromEntries([...aliasUsage].sort()),
  unmatchedMatrixValues: Object.fromEntries([...unmatchedMatrix].sort()),
  materialUnmatchedThreshold: 5,
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
