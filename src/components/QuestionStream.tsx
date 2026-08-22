import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ECharts } from "echarts";
import type { ChartType, DataBundle, Question, Respondent } from "../types";
import { analyzeQuestion } from "../lib/analysis";
import { ChartSwitcher } from "./ChartSwitcher";
import { DataTable } from "./DataTable";
import { ResponseReader } from "./ResponseReader";
import { SurveyChart } from "./SurveyChart";
import { DownloadIcon } from "./DownloadIcon";
import { sectionAccentStyle } from "../lib/sectionAccent";
import { availableChartTypes } from "../lib/charts";

function estimatedQuestionHeight(question: Question) {
  const isQualitative = question.kind === "qualitative";
  const baseHeight = isQualitative ? 900 : 1010;
  const additionalHeadingLines = Math.max(0, Math.ceil((question.prompt.length - 75) / 85));
  const multiSelectNote = question.kind === "multi_select" || question.kind === "language_need" ? 20 : 0;
  return baseHeight + additionalHeadingLines * 22 + multiSelectNote;
}

function ViewportVisualFrame({ chart, ready, children }: { chart: ChartType; ready: boolean; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setInViewport(true);
      observer.disconnect();
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={frame} className={ready && inViewport ? "visual-frame is-in-view" : "visual-frame"} data-chart-view={chart}>{children}</div>;
}

function QuestionContent({
  question,
  respondents,
  bundle,
  active,
  groupKey,
  sectionIndex,
  requestedChart,
  onChartChange,
  onResetFilters
}: {
  question: Question;
  respondents: Respondent[];
  bundle: DataBundle;
  active: boolean;
  groupKey: string;
  sectionIndex: number;
  requestedChart: ChartType | null;
  onChartChange: (question: Question, chart: ChartType) => void;
  onResetFilters: () => void;
}) {
  const chartInstance = useRef<ECharts | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [fullDataOpen, setFullDataOpen] = useState(false);
  const analysis = useMemo(
    () => analyzeQuestion(respondents, question, bundle.mode === "public" ? (bundle.suppressionThreshold ?? 5) : 0),
    [respondents, question, bundle.mode, bundle.suppressionThreshold]
  );
  const charts = useMemo(() => {
    return availableChartTypes(question, analysis.categories.length);
  }, [question, analysis.categories.length]);
  const chart = requestedChart && charts.includes(requestedChart) ? requestedChart : question.chart.default;
  const dataPanelId = `question-${question.number}-full-data`;
  const Heading = "h2";
  const exportPng = () => {
    const url = chartInstance.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    if (!url || analysis.suppressed) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `q${question.number}-${chart}.png`;
    anchor.click();
  };

  return (
    <article className={active ? "question-workspace active" : "question-workspace"} data-question-content>
      <header className="question-header">
        <Heading tabIndex={-1} data-question-heading>
          <span>Q{question.number}</span>{question.prompt}
        </Heading>
        {(question.kind === "multi_select" || question.kind === "language_need") && <p className="question-note">Respondents could select more than one option; percentages may total more than 100%.</p>}
      </header>

      {analysis.suppressed ? (
        <div className="empty-state"><h2>Insufficient responses for this filtered view</h2><p>Public results are hidden when fewer than {bundle.suppressionThreshold ?? 5} respondents remain. Remove a filter to continue.</p><button className="primary" onClick={onResetFilters}>Reset filters</button></div>
      ) : question.kind === "qualitative" ? (
        <ResponseReader question={question} respondents={respondents} mode={bundle.mode} />
      ) : (
        <>
          <ViewportVisualFrame chart={chart} ready={chart === "data_table" || chartReady}>
            {chart !== "data_table" && <button type="button" className="download-icon-button chart-download-button has-file-tooltip" aria-label="Download chart as PNG" data-tooltip="Download PNG image" onClick={exportPng}><DownloadIcon /></button>}
            {chart === "data_table" ? <DataTable question={question} analysis={analysis} embedded /> : <SurveyChart question={question} analysis={analysis} chart={chart} groupKey={groupKey} sectionIndex={sectionIndex} onReady={(instance) => { chartInstance.current = instance; setChartReady(true); }} />}
          </ViewportVisualFrame>
          <div className="chart-controls"><ChartSwitcher charts={charts} value={chart} onChange={(next) => { setFullDataOpen(false); onChartChange(question, next); }} />{chart !== "data_table" && <button className="full-data-toggle" aria-expanded={fullDataOpen} aria-controls={dataPanelId} onClick={() => setFullDataOpen((open) => !open)}>{fullDataOpen ? "Hide full data" : "View full data"}</button>}</div>
          {analysis.validResponses === 0 && <div className="empty-state compact-empty"><h2>No valid responses</h2><p>No responses are available for this question with the current filters and branch conditions.</p></div>}
          {chart !== "data_table" && <DataTable question={question} analysis={analysis} expanded={fullDataOpen} panelId={dataPanelId} />}
        </>
      )}
    </article>
  );
}

export function VirtualQuestionSection({
  question,
  respondents,
  bundle,
  active,
  requestedChart,
  groupKey,
  sectionIndex,
  onChartChange,
  onResetFilters
}: {
  question: Question;
  respondents: Respondent[];
  bundle: DataBundle;
  active: boolean;
  requestedChart: ChartType | null;
  groupKey: string;
  sectionIndex: number;
  onChartChange: (question: Question, chart: ChartType) => void;
  onResetFilters: () => void;
}) {
  const host = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pendingHeight = useRef<number | null>(null);
  const [mounted, setMounted] = useState(active);
  const [height, setHeight] = useState(() => estimatedQuestionHeight(question));
  const visible = mounted || active;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const mountObserver = new IntersectionObserver(
      ([entry]) => setMounted(entry.isIntersecting || active),
      { root: null, rootMargin: "110% 0px 110% 0px", threshold: 0 }
    );
    mountObserver.observe(element);
    return () => mountObserver.disconnect();
  }, [active]);

  useEffect(() => {
    const element = content.current;
    if (!element || !visible) return;
    let settleTimer = 0;
    const commitHeight = () => {
      settleTimer = 0;
      const measured = pendingHeight.current;
      pendingHeight.current = null;
      if (measured !== null && measured > 200) setHeight(measured);
    };
    const scheduleCommit = () => {
      window.clearTimeout(settleTimer);
      // Keep the document height stable while a wheel, touch gesture, or native
      // scrollbar drag is still in progress. Reflowing the stream too quickly
      // makes the browser's scrollbar thumb move underneath the pointer.
      settleTimer = window.setTimeout(commitHeight, 520);
    };
    const updateHeight = () => {
      const measured = Math.ceil(element.getBoundingClientRect().height);
      if (measured > 200) {
        pendingHeight.current = measured;
        scheduleCommit();
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("scroll", scheduleCommit, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleCommit);
    };
  }, [visible]);

  return (
    <section
      ref={host}
      id={`question-${question.number}`}
      className={active ? "virtual-question active" : "virtual-question"}
      data-question-number={question.number}
      data-mounted={visible ? "true" : "false"}
      style={{ ...sectionAccentStyle(groupKey, sectionIndex), height: `${height}px` }}
      aria-label={`Question ${question.number}`}
    >
      {visible ? (
        <div ref={content} className="virtual-question__content">
          <div className="question-reveal"><QuestionContent question={question} respondents={respondents} bundle={bundle} active={active} groupKey={groupKey} sectionIndex={sectionIndex} requestedChart={requestedChart} onChartChange={onChartChange} onResetFilters={onResetFilters} /></div>
        </div>
      ) : (
        <div className="question-placeholder" aria-hidden="true"><span>Q{question.number}</span><div><p>{question.prompt}</p></div></div>
      )}
    </section>
  );
}
