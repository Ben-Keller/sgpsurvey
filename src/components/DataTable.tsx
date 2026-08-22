import type { Analysis, Question } from "../types";
import { csvCell, downloadText } from "../lib/export";
import { DownloadIcon } from "./DownloadIcon";

export function DataTable({ question, analysis, embedded = false, expanded = false, panelId }: { question: Question; analysis: Analysis; embedded?: boolean; expanded?: boolean; panelId?: string }) {
  const rows = analysis.matrix.length
    ? analysis.matrix.map((item) => [item.label, item.count, item.mean?.toFixed(2) ?? "—", item.normalized?.toFixed(1) ?? "—"])
    : analysis.categories.map((item) => [item.label, item.count, item.percent.toFixed(1)]);
  const headers = analysis.matrix.length ? ["Item", "Scored n", "Mean (1–4)", "Normalized score (%)"] : ["Response", "Count", "% of valid respondents"];
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  const contents = <>
      <div className="table-actions">
        <button className="download-icon-button has-file-tooltip" aria-label="Download data as CSV" data-tooltip="Download CSV data" onClick={() => downloadText(`q${question.number}-data.csv`, csv)}><DownloadIcon /></button>
      </div>
      <div className="table-scroll" role="region" aria-label={`Full data for question ${question.number}`} tabIndex={0}>
        <table>
          <thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={String(row[0])}>{row.map((value, index) => index === 0 ? <th key={index} scope="row">{value}</th> : <td key={index}>{value}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="method-note">Blank responses: {analysis.blankResponses}. {question.kind === "multi_select" || question.kind === "language_need" ? `${analysis.totalSelections} total selections; percentages use respondents, so they may exceed 100%.` : "Percentages use valid responses."}</p>
    </>;

  if (embedded) {
    return <section className="data-table-view" aria-label={`Data table for question ${question.number}`}><header><strong>Full data</strong></header>{contents}</section>;
  }

  if (!expanded) return null;
  return <section id={panelId} className="data-panel data-panel--expanded" aria-label={`Expanded data for question ${question.number}`}><header><strong>Full data</strong></header>{contents}</section>;
}
