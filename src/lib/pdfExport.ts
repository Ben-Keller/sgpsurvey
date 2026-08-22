import type { EChartsType } from "echarts";
import type { Analysis, ChartType, DataBundle, Manifest, Question, Respondent } from "../types";
import { analyzeQuestion, isEligible } from "./analysis";
import { sectionChartPalette } from "./sectionAccent";
import { makeChartOption } from "../components/SurveyChart";
import { availableChartTypes } from "./charts";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_RENDER_SCALE = 1.6;
const MARGIN = 86;

export const PDF_SUMMARY_INTRO = [
  "To support the development of the SGP Knowledge and Learning Platform, this short survey seeks to better understand how knowledge, guidance, and technical support are provided throughout the SGP project lifecycle. We are requesting feedback from SGP country teams, CSO/CBO grantee partners, SGP 2.0 Implementing Agencies (UNDP/FAO/CI), and SGP National Steering Committee members.",
  "The SGP Global Knowledge and Learning Platform is a proposed digital platform being jointly developed by UNDP, FAO, and Conservation International (CI) under SGP 2.0. The platform will serve as a single, user-friendly hub where SGP stakeholders can access practical guidance, training materials, tools, case studies, and lessons learned from more than 30 years of SGP experience. It will also promote peer learning, mentoring, collaboration, and knowledge exchange across the global SGP community, while improving access to information through multilingual and mobile-friendly features. The platform is intended to strengthen the effectiveness, visibility, and long-term impact of SGP-supported initiatives worldwide.",
  "This survey methodology covered four stakeholder groups to map current challenges and needs that the platform can help address and to scope the existing workflows and system boundaries that should be accommodated through the design process. This document provides the responses from the survey and visualizations of the results."
].join("\n\n");

type PdfExportOptions = {
  manifest: Manifest;
  dataMode: "public" | "internal";
  baseUrl: string;
  chartSelections: Record<string, ChartType>;
  onProgress?: (message: string) => void;
};

function slug(value: string) {
  return ({
    country_team: "country-teams",
    grantee_partners: "grantee-partners",
    implementing_agencies: "implementing-agencies",
    steering_committee: "steering-committees"
  } as Record<string, string>)[value] ?? value.replaceAll("_", "-");
}

function makePage() {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_WIDTH * PAGE_RENDER_SCALE);
  canvas.height = Math.round(PAGE_HEIGHT * PAGE_RENDER_SCALE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  context.scale(PAGE_RENDER_SCALE, PAGE_RENDER_SCALE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#f7f7f2";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.textBaseline = "top";
  return { canvas, context };
}

function linesFor(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = String(text).split(/\n/);
  const lines: string[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) lines.push("");
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    if (paragraphIndex < paragraphs.length - 1) lines.push("");
  });
  return lines;
}

function drawLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawWrapped(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  return drawLines(context, linesFor(context, text, maxWidth), x, y, lineHeight);
}

function drawPageChrome(context: CanvasRenderingContext2D, accent: string, groupLabel: string, pageLabel: string) {
  context.fillStyle = accent;
  context.fillRect(0, 0, PAGE_WIDTH, 16);
  context.font = "600 20px Futura, Arial, sans-serif";
  context.fillStyle = "#53616b";
  context.fillText(groupLabel, MARGIN, 42);
  context.textAlign = "right";
  context.fillText(pageLabel, PAGE_WIDTH - MARGIN, 42);
  context.textAlign = "left";
  context.strokeStyle = "#dce4e0";
  context.beginPath();
  context.moveTo(MARGIN, PAGE_HEIGHT - 58);
  context.lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 58);
  context.stroke();
}

async function imageFromUrl(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export function pdfChartPixelHeight(chartType: ChartType, itemCount: number) {
  if (["ranked_bar", "ordered_bar", "diverging_bar", "lollipop", "dot_plot"].includes(chartType)) {
    return Math.min(650, Math.max(220, itemCount * 44 + 110));
  }
  if (["heatmap", "diverging_stacked"].includes(chartType)) return Math.min(650, Math.max(330, itemCount * 38 + 150));
  return 620;
}

async function renderChart(question: Question, analysis: Analysis, chartType: ChartType, groupKey: string, sectionIndex: number) {
  const itemCount = analysis.matrix.length || analysis.categories.length;
  const height = pdfChartPixelHeight(chartType, itemCount);
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:1060px;height:${height}px;background:#fff;`;
  document.body.appendChild(host);
  let chart: EChartsType | null = null;
  try {
    const echarts = await import("echarts");
    chart = echarts.init(host, undefined, { renderer: "canvas", devicePixelRatio: 2 });
    chart.setOption(makeChartOption(question, analysis, chartType, groupKey, sectionIndex, chartType !== "treemap"), { notMerge: true, lazyUpdate: false });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (chartType === "treemap") await new Promise<void>((resolve) => setTimeout(resolve, 260));
    return { url: chart.getDataURL({ type: "jpeg", pixelRatio: 2.2, backgroundColor: "#ffffff", excludeComponents: ["toolbox"] }), width: 1060, height };
  } finally {
    chart?.dispose();
    host.remove();
  }
}

function drawStakeholderCover(
  context: CanvasRenderingContext2D,
  logo: CanvasImageSource,
  groupLabel: string,
  accent: string,
  questionCount: number,
  sectionCount: number,
  respondentCount: number
) {
  context.fillStyle = accent;
  context.fillRect(0, 0, PAGE_WIDTH, 28);
  context.drawImage(logo, MARGIN + 52, 100, 210, 95);
  context.fillRect(MARGIN, 226, 18, 470);
  context.font = "600 21px Futura, Arial, sans-serif";
  context.fillStyle = accent;
  context.fillText("SGP KNOWLEDGE AND LEARNING PLATFORM SURVEY", MARGIN + 52, 240);
  context.font = "600 72px Futura, Arial, sans-serif";
  context.fillStyle = "#17212b";
  const titleY = drawWrapped(context, groupLabel, MARGIN + 52, 294, PAGE_WIDTH - MARGIN * 2 - 52, 82);
  context.font = "400 25px PP Neue Montreal, Arial, sans-serif";
  context.fillStyle = "#53616b";
  context.fillText("Complete survey results", MARGIN + 52, titleY + 34);

  const metricsY = Math.max(690, titleY + 150);
  context.fillStyle = "#ffffff";
  context.fillRect(MARGIN, metricsY, PAGE_WIDTH - MARGIN * 2, 168);
  const metrics = [
    [String(questionCount), "QUESTIONS"],
    [String(sectionCount), "SECTIONS"],
    [String(respondentCount), "RESPONDENTS"]
  ];
  const metricWidth = (PAGE_WIDTH - MARGIN * 2) / metrics.length;
  metrics.forEach(([value, label], index) => {
    const x = MARGIN + metricWidth * index + 30;
    if (index > 0) {
      context.strokeStyle = "#dce4e0";
      context.beginPath();
      context.moveTo(MARGIN + metricWidth * index, metricsY + 34);
      context.lineTo(MARGIN + metricWidth * index, metricsY + 134);
      context.stroke();
    }
    context.font = "600 44px Futura, Arial, sans-serif";
    context.fillStyle = accent;
    context.fillText(value, x, metricsY + 34);
    context.font = "600 16px Futura, Arial, sans-serif";
    context.fillStyle = "#53616b";
    context.fillText(label, x, metricsY + 96);
  });
}

function drawSectionChangeBlock(
  context: CanvasRenderingContext2D,
  section: string,
  sectionIndex: number,
  sectionCount: number,
  accent: string
) {
  const y = 92;
  context.fillStyle = accent;
  context.fillRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 126);
  context.font = "600 16px Futura, Arial, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.82)";
  context.fillText(`SECTION ${String(sectionIndex + 1).padStart(2, "0")} OF ${String(sectionCount).padStart(2, "0")}`, MARGIN + 28, y + 24);
  context.font = "600 31px Futura, Arial, sans-serif";
  context.fillStyle = "#ffffff";
  drawWrapped(context, section, MARGIN + 28, y + 58, PAGE_WIDTH - MARGIN * 2 - 56, 36);
  return y + 154;
}

function drawQuestionHeading(
  context: CanvasRenderingContext2D,
  question: Question,
  analysis: Analysis,
  chartType: ChartType,
  accent: string,
  continued = false,
  startY = 92
) {
  context.fillStyle = accent;
  context.font = "600 19px Futura, Arial, sans-serif";
  context.fillText(`${question.section.toUpperCase()}${continued ? " - CONTINUED" : ""}`, MARGIN, startY);
  context.fillStyle = "#17212b";
  context.font = "600 42px Futura, Arial, sans-serif";
  const titleY = drawWrapped(context, `Q${question.number}  ${question.prompt}`, MARGIN, startY + 34, PAGE_WIDTH - MARGIN * 2, 48);
  context.font = "500 18px PP Neue Montreal, Arial, sans-serif";
  context.fillStyle = "#5d6b78";
  const chartLabel = chartType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  context.fillText(`${chartLabel}  |  ${analysis.validResponses} valid responses`, MARGIN, titleY + 10);
  return titleY + 52;
}

function approvedResponses(respondents: Respondent[], question: Question, mode: "public" | "internal") {
  return respondents
    .filter((respondent) => isEligible(respondent, question))
    .map((respondent) => respondent.answers[question.id])
    .filter((answer): answer is Extract<NonNullable<typeof answer>, { kind: "text" }> => answer?.kind === "text" && Boolean(answer.value) && (mode === "internal" || answer.approved))
    .map((answer) => answer.value ?? "");
}

export async function downloadSurveyPdf({ manifest, dataMode, baseUrl, chartSelections, onProgress }: PdfExportOptions) {
  await document.fonts.ready;
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const logo = await imageFromUrl(`${baseUrl}branding/sgp-logo.png`);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  let pageCount = 0;
  const addPage = (canvas: HTMLCanvasElement) => {
    if (pageCount > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 595.28, 841.89, undefined, "NONE");
    pageCount++;
  };

  const cover = makePage();
  cover.context.fillStyle = "#3f7e44";
  cover.context.fillRect(0, 0, PAGE_WIDTH, 26);
  cover.context.drawImage(logo, MARGIN, 92, 260, 117);
  cover.context.fillStyle = "#17212b";
  cover.context.font = "600 62px Futura, Arial, sans-serif";
  let coverY = drawWrapped(
    cover.context,
    "SGP Knowledge and Learning Platform Survey",
    MARGIN,
    252,
    PAGE_WIDTH - MARGIN * 2,
    70
  );
  cover.context.font = "400 20px PP Neue Montreal, Arial, sans-serif";
  cover.context.fillStyle = "#394851";
  coverY = drawWrapped(cover.context, PDF_SUMMARY_INTRO, MARGIN, coverY + 30, PAGE_WIDTH - MARGIN * 2, 30);
  cover.context.font = "600 22px Futura, Arial, sans-serif";
  cover.context.fillStyle = "#3f7e44";
  cover.context.fillText(`${manifest.totalQuestions} questions | ${manifest.totalRespondents} survey records`, MARGIN, coverY + 34);
  cover.context.font = "400 19px PP Neue Montreal, Arial, sans-serif";
  cover.context.fillStyle = "#5d6b78";
  cover.context.fillText(`Generated ${new Date().toLocaleString()}`, MARGIN, coverY + 72);
  addPage(cover.canvas);

  let completedQuestions = 0;
  for (const group of manifest.groups) {
    onProgress?.(`Loading ${group.label}...`);
    const response = await fetch(`${baseUrl}data/${dataMode}/${slug(group.key)}.json?v=${encodeURIComponent(manifest.schemaVersion)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${group.label} data (${response.status}).`);
    const bundle = await response.json() as DataBundle;
    const sectionNames = [...new Set(group.questions.map((question) => question.section))];
    const groupAccent = sectionChartPalette(group.key, 0)[0];
    const stakeholderCover = makePage();
    drawStakeholderCover(
      stakeholderCover.context,
      logo,
      group.label,
      groupAccent,
      group.questions.length,
      sectionNames.length,
      bundle.respondents.length
    );
    addPage(stakeholderCover.canvas);
    let activeSection = "";

    for (const question of group.questions) {
      completedQuestions++;
      onProgress?.(`Preparing Q${question.number} - ${completedQuestions} of ${manifest.totalQuestions}`);
      const analysis = analyzeQuestion(bundle.respondents, question, dataMode === "public" ? (bundle.suppressionThreshold ?? 5) : 0);
      const chosen = chartSelections[question.id];
      const compatible = availableChartTypes(question, analysis.categories.length);
      const selectedChartType = chosen && compatible.includes(chosen) ? chosen : question.chart.default;
      const chartType = selectedChartType === "data_table"
        ? compatible.find((candidate) => candidate !== "data_table" && candidate !== "response_reader") ?? question.chart.default
        : selectedChartType;
      const sectionIndex = sectionNames.indexOf(question.section);
      const accent = sectionChartPalette(group.key, sectionIndex)[0];
      const sectionChanged = question.section !== activeSection;
      activeSection = question.section;

      if (question.kind === "qualitative" || chartType === "response_reader") {
        const responses = approvedResponses(bundle.respondents, question, dataMode);
        let responseIndex = 0;
        let continuation = false;
        do {
          const page = makePage();
          drawPageChrome(page.context, accent, group.label, `Q${question.number}`);
          const headingY = sectionChanged && !continuation
            ? drawSectionChangeBlock(page.context, question.section, sectionIndex, sectionNames.length, accent)
            : 92;
          let y = drawQuestionHeading(page.context, question, analysis, chartType, accent, continuation, headingY) + 12;
          page.context.font = "500 18px PP Neue Montreal, Arial, sans-serif";
          page.context.fillStyle = "#53616b";
          page.context.fillText(`${responses.length} written responses`, MARGIN, y);
          y += 42;
          if (!responses.length) {
            page.context.fillStyle = "#ffffff";
            page.context.fillRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 110);
            page.context.fillStyle = "#53616b";
            page.context.fillText("No written responses are available.", MARGIN + 22, y + 35);
          }
          while (responseIndex < responses.length && y < PAGE_HEIGHT - 150) {
            page.context.font = "400 18px PP Neue Montreal, Arial, sans-serif";
            const lines = linesFor(page.context, responses[responseIndex], PAGE_WIDTH - MARGIN * 2 - 38);
            const availableLines = Math.max(1, Math.floor((PAGE_HEIGHT - 118 - y) / 27) - 2);
            if (lines.length > availableLines && y > 500) break;
            const shown = lines.slice(0, availableLines);
            const cardHeight = shown.length * 27 + 32;
            page.context.fillStyle = "#ffffff";
            page.context.fillRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, cardHeight);
            page.context.fillStyle = "#25333d";
            page.context.font = "400 18px PP Neue Montreal, Arial, sans-serif";
            drawLines(page.context, shown, MARGIN + 19, y + 16, 27);
            y += cardHeight + 12;
            responseIndex++;
          }
          addPage(page.canvas);
          continuation = true;
        } while (responseIndex < responses.length);
      } else {
        const page = makePage();
        drawPageChrome(page.context, accent, group.label, `Q${question.number}`);
        const headingY = sectionChanged
          ? drawSectionChangeBlock(page.context, question.section, sectionIndex, sectionNames.length, accent)
          : 92;
        const contentY = drawQuestionHeading(page.context, question, analysis, chartType, accent, false, headingY);
        if (analysis.suppressed) {
          page.context.font = "500 23px PP Neue Montreal, Arial, sans-serif";
          page.context.fillStyle = "#53616b";
          page.context.fillText("Results are suppressed for this public view.", MARGIN, contentY + 70);
        } else {
          const chartRender = await renderChart(question, analysis, chartType, group.key, sectionIndex);
          const chartImage = await imageFromUrl(chartRender.url);
          const chartWidth = PAGE_WIDTH - MARGIN * 2 - 20;
          const chartHeight = chartRender.height * (chartWidth / chartRender.width);
          page.context.fillStyle = "#ffffff";
          page.context.fillRect(MARGIN, contentY + 10, PAGE_WIDTH - MARGIN * 2, chartHeight + 20);
          page.context.drawImage(chartImage, MARGIN + 10, contentY + 20, chartWidth, chartHeight);
        }
        addPage(page.canvas);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(95, 105, 112);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 552, 821, { align: "right" });
  }
  onProgress?.("Finishing PDF...");
  pdf.save(`sgp-survey-all-tabs-${new Date().toISOString().slice(0, 10)}.pdf`);
}
