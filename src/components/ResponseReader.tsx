import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Question, Respondent } from "../types";
import { csvCell, downloadText } from "../lib/export";
import { isEligible } from "../lib/analysis";
import { DownloadIcon } from "./DownloadIcon";

function ResponseCard({ label, text, compact, expanded, onToggle }: { label?: string; text: string; compact: boolean; expanded: boolean; onToggle: () => void }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [canExpand, setCanExpand] = useState(false);

  useLayoutEffect(() => {
    if (!compact || expanded || !paragraph.current) return;
    let frame = 0;
    const measure = () => {
      frame = requestAnimationFrame(() => {
        const element = paragraph.current;
        if (element) setCanExpand(element.scrollHeight > element.clientHeight + 1);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paragraph.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [compact, expanded, text]);

  return <article className={expanded ? "response-card expanded" : "response-card"}>{label && <div className="response-meta">{label}</div>}<p ref={paragraph}>{text}</p>{compact && canExpand && <div className="response-actions"><button aria-expanded={expanded} onClick={onToggle}>{expanded ? "Collapse" : "Expand"}</button></div>}</article>;
}

export function ResponseReader({ question, respondents, mode }: { question: Question; respondents: Respondent[]; mode: "public" | "internal" }) {
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const all = useMemo(() => respondents.filter((r) => isEligible(r, question)).map((r) => ({ respondent: r, answer: r.answers[question.id] })).filter((entry) => entry.answer?.kind === "text" && entry.answer.value), [respondents, question]);
  const results = useMemo(() => {
    const query = search.toLocaleLowerCase();
    return all.filter(({ answer }) => answer.kind === "text" && answer.value?.toLocaleLowerCase().includes(query));
  }, [all, search]);
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const visible = results.slice((page - 1) * pageSize, page * pageSize);
  const blank = respondents.filter((r) => isEligible(r, question)).length - all.length;
  const exportCsv = [["Response", "Response language"].map(csvCell).join(","), ...results.map(({ respondent, answer }) => [csvCell(answer.kind === "text" ? answer.value : ""), csvCell(respondent.dimensions.response_language)].join(","))].join("\n");
  const toggleExpanded = (respondentId: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(respondentId)) next.delete(respondentId); else next.add(respondentId);
    return next;
  });

  if (!all.length) {
    return <div className="empty-state"><h2>No qualitative responses</h2><p>No written responses are available for this question with the current filters.</p></div>;
  }

  return (
    <section className={compact ? "response-reader compact" : "response-reader"} aria-label="Qualitative responses">
      <div className="reader-controls">
        <input className="reader-search" type="search" aria-label="Search responses" placeholder="Search responses" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <label className="display-mode-switch"><span>Compact</span><input type="checkbox" role="switch" aria-label="Response display mode" checked={!compact} onChange={(event) => { setCompact(!event.target.checked); setExpanded(new Set()); }} /><span className="switch-track" aria-hidden="true"><span /></span><span>Full</span></label>
        <button className="download-icon-button has-file-tooltip" aria-label="Download responses as CSV" data-tooltip="Download CSV responses" onClick={() => downloadText(`q${question.number}-responses.csv`, exportCsv)}><DownloadIcon /></button>
      </div>
      <p className="reader-count">{results.length} responses · {blank} blank answers</p>
      <div className="response-scroll" role="region" aria-label={`Scrollable responses for question ${question.number}`} tabIndex={0}>
        <div className="response-list">{visible.map(({ respondent, answer }) => { const isExpanded = expanded.has(respondent.id); return <ResponseCard key={respondent.id} label={mode === "internal" ? String(respondent.dimensions.response_language ?? "Unknown language") : undefined} text={answer.kind === "text" ? answer.value ?? "" : ""} compact={compact} expanded={isExpanded} onToggle={() => toggleExpanded(respondent.id)} />; })}</div>
      </div>
      <nav className="pagination" aria-label="Response pages"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></nav>
    </section>
  );
}
