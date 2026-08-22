import fs from "node:fs";
import path from "node:path";
import { Manifest, readJson, root, slugForGroup } from "./lib";

const manifest = readJson<Manifest>("question-manifest.json");
const report = readJson<any>("data/qa/normalization-report.json");
const errors: string[] = [];
const questions = manifest.groups.flatMap((group) => group.questions);

if (questions.length !== 96 || manifest.totalQuestions !== 96) errors.push(`Expected 96 questions; found ${questions.length}.`);
if (new Set(questions.map((q) => q.id)).size !== 96) errors.push("Question IDs are not unique.");

const expectedMatrices = new Map([[14, 14], [17, 14], [65, 10], [67, 9], [86, 9], [94, 8], [95, 7]]);
for (const [number, count] of expectedMatrices) {
  const question = questions.find((q) => q.number === number);
  if (!question || !question.kind.startsWith("matrix_") || question.matrixItems.length !== count || question.chart.default !== "radar") {
    errors.push(`Q${number} is not a ${count}-item radar matrix.`);
  }
}

for (const group of manifest.groups) {
  const file = path.join(root, `public/data/public/${slugForGroup(group.key)}.json`);
  const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
  if (bundle.respondents.length !== group.respondentCount) errors.push(`${group.label}: expected ${group.respondentCount}; found ${bundle.respondents.length}.`);
  const serialized = JSON.stringify(bundle).toLowerCase();
  if (serialized.includes("timestamp")) errors.push(`${group.label}: public bundle contains a timestamp field.`);
  for (const respondent of bundle.respondents) {
    for (const answer of Object.values(respondent.answers) as any[]) {
      if (answer.kind === "text" && answer.value && !answer.approved) errors.push(`${group.label}: qualitative text is missing publication approval.`);
    }
  }
  for (const question of group.questions.filter((candidate) => candidate.kind === "qualitative")) {
    const published = bundle.respondents.filter((respondent: any) => {
      const answer = respondent.answers[question.id];
      return answer?.kind === "text" && Boolean(answer.value) && answer.approved === true;
    }).length;
    if (published !== question.responseCountUnfiltered) {
      errors.push(`Q${question.number}: expected ${question.responseCountUnfiltered} approved qualitative responses; found ${published}.`);
    }
  }
}

for (const [value, count] of Object.entries(report.unmatchedMatrixValues) as [string, number][]) {
  if (count >= report.materialUnmatchedThreshold) errors.push(`Material unmatched matrix value (${count}): ${value}`);
}

if (errors.length) {
  console.error(errors.map((error) => `• ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Validated 96 questions, 280 responses, seven matrices, and approved public qualitative responses.`);
