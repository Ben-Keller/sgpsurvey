export type ChartType =
  | "ranked_bar"
  | "ordered_bar"
  | "diverging_bar"
  | "diverging_stacked"
  | "lollipop"
  | "dot_plot"
  | "donut"
  | "treemap"
  | "world_map"
  | "radar"
  | "heatmap"
  | "data_table"
  | "response_reader";

export type Answer =
  | { kind: "single"; value: string | null }
  | { kind: "multi"; values: string[]; rawUnclassified?: string[] }
  | { kind: "matrix"; values: Record<string, string | null> }
  | { kind: "text"; value: string | null; approved: boolean };

export interface Respondent {
  id: string;
  stakeholder: string;
  dimensions: Record<string, string | string[] | null>;
  answers: Record<string, Answer>;
}

export interface DataBundle {
  schemaVersion: string;
  mode: "public" | "internal";
  suppressionThreshold?: number;
  group: string;
  respondents: Respondent[];
}

export interface Question {
  id: string;
  number: number;
  section: string;
  prompt: string;
  kind: string;
  responseCountUnfiltered: number;
  eligibility: { mode: string; basedOn?: string; rule?: string };
  chart: { default: ChartType; alternatives: ChartType[] };
  sourceColumns: { index: number; header: string }[];
  matrixItems: string[];
  display: Record<string, unknown>;
}

export interface Group {
  key: string;
  label: string;
  sourceSheet: string;
  respondentCount: number;
  questionRange: string;
  filters: { key: string; label: string; source: string }[];
  questions: Question[];
}

export interface Manifest {
  schemaVersion: string;
  totalRespondents: number;
  totalQuestions: number;
  groups: Group[];
}

export interface CategoryDatum {
  label: string;
  count: number;
  percent: number;
}

export interface MatrixDatum {
  label: string;
  count: number;
  mean: number | null;
  normalized: number | null;
  distribution: Record<string, number>;
}

export interface Analysis {
  filteredBase: number;
  eligibleBase: number;
  validResponses: number;
  blankResponses: number;
  totalSelections: number;
  categories: CategoryDatum[];
  matrix: MatrixDatum[];
  suppressed: boolean;
}
