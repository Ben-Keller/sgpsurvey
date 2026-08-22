import fs from "node:fs";
import path from "node:path";

export type Manifest = {
  schemaVersion: string;
  totalRespondents: number;
  totalQuestions: number;
  groups: ManifestGroup[];
};

export type ManifestGroup = {
  key: string;
  label: string;
  sourceSheet: string;
  respondentCount: number;
  questionRange: string;
  filters: { key: string; label: string; source: string }[];
  questions: ManifestQuestion[];
};

export type ManifestQuestion = {
  id: string;
  number: number;
  section: string;
  prompt: string;
  kind: string;
  responseCountUnfiltered: number;
  eligibility: { mode: string; basedOn?: string; rule?: string };
  chart: { default: string; alternatives: string[] };
  sourceColumns: { index: number; header: string }[];
  matrixItems: string[];
  display: Record<string, unknown>;
};

export const root = process.cwd();

export function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as T;
}

export function writeJson(relativePath: string, value: unknown) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

export function cleanText(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const value = String(input)
    .normalize("NFKC")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return value || null;
}

export function normalizedKey(input: string): string {
  return input
    .toLocaleLowerCase("en")
    .replace(/\s*([,;:.!?])\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugForGroup(key: string): string {
  return {
    country_team: "country-teams",
    grantee_partners: "grantee-partners",
    implementing_agencies: "implementing-agencies",
    steering_committee: "steering-committees"
  }[key] ?? key.replaceAll("_", "-");
}
