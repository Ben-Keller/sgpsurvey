import fs from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../question-manifest.json";
import report from "../data/qa/normalization-report.json";

describe("compiled survey contract", () => {
  it("contains exactly 96 configured questions", () => {
    expect(manifest.groups.flatMap((group) => group.questions)).toHaveLength(96);
  });

  it("keeps every required matrix grouped with radar as the default", () => {
    const expected = new Map([[14, 14], [17, 14], [65, 10], [67, 9], [86, 9], [94, 8], [95, 7]]);
    const questions = manifest.groups.flatMap((group) => group.questions);
    expected.forEach((items, number) => {
      const question = questions.find((candidate) => candidate.number === number)!;
      expect(question.matrixItems).toHaveLength(items);
      expect(question.chart.default).toBe("radar");
    });
  });

  it("protects known option labels that contain commas", () => {
    const categories = (report.canonicalCategories as Record<string, Record<string, number>>)["country_team.q11"];
    expect(categories["Unrealistic work plan, timeframe"]).toBeGreaterThan(0);
    expect(categories["Unrealistic work plan"]).toBeUndefined();
  });

  it("ships no timestamps and only approved qualitative text in public bundles", () => {
    const qualitativeAnswers: any[] = [];
    for (const group of ["country-teams", "grantee-partners", "implementing-agencies", "steering-committees"]) {
      const text = fs.readFileSync(`public/data/public/${group}.json`, "utf8");
      expect(text.toLowerCase()).not.toContain("timestamp");
      const bundle = JSON.parse(text);
      qualitativeAnswers.push(...bundle.respondents.flatMap((row: any) => Object.values(row.answers)).filter((answer: any) => answer.kind === "text" && answer.value));
    }
    expect(qualitativeAnswers.length).toBeGreaterThan(0);
    expect(qualitativeAnswers.every((answer) => answer.approved === true)).toBe(true);
  });

  it("publishes the configured number of responses for every qualitative question", () => {
    for (const group of manifest.groups) {
      const slug = ({ country_team: "country-teams", grantee_partners: "grantee-partners", implementing_agencies: "implementing-agencies", steering_committee: "steering-committees" } as Record<string, string>)[group.key];
      const bundle = JSON.parse(fs.readFileSync(`public/data/public/${slug}.json`, "utf8"));
      for (const question of group.questions.filter((candidate) => candidate.kind === "qualitative")) {
        const published = bundle.respondents.filter((row: any) => {
          const answer = row.answers[question.id];
          return answer?.kind === "text" && Boolean(answer.value) && answer.approved === true;
        });
        expect(published, `Q${question.number}`).toHaveLength(question.responseCountUnfiltered);
      }
    }
  });
});
