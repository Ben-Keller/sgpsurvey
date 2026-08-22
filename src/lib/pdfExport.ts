import type { EChartsType } from "echarts";
import type { Analysis, ChartType, DataBundle, Manifest, Question, Respondent } from "../types";
import { analyzeQuestion, isEligible, optionOrder } from "./analysis";
import { sectionChartPalette } from "./sectionAccent";
import { makeChartOption } from "../components/SurveyChart";
import { availableChartTypes } from "./charts";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_RENDER_SCALE = 1.6;
const MARGIN = 86;

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

async function renderChart(question: Question, analysis: Analysis, chartType: ChartType, groupKey: string, sectionIndex: number) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-12000px;top:0;width:1060px;height:690px;background:#fff;";
  document.body.appendChild(host);
  let chart: EChartsType | null = null;
  try {
    const echarts = await import("echarts");
    chart = echarts.init(host, undefined, { renderer: "canvas", devicePixelRatio: 2 });
    chart.setOption(makeChartOption(question, analysis, chartType, groupKey, sectionIndex, chartType !== "treemap"), { notMerge: true, lazyUpdate: false });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (chartType === "treemap") await new Promise<void>((resolve) => setTimeout(resolve, 260));
    return chart.getDataURL({ type: "jpeg", pixelRatio: 2.2, backgroundColor: "#ffffff", excludeComponents: ["toolbox"] });
  } finally {
    chart?.dispose();
    host.remove();
  }
}

function drawQuestionHeading(context: CanvasRenderingContext2D, question: Question, analysis: Analysis, chartType: ChartType, accent: string, continued = false) {
  context.fillStyle = accent;
  context.font = "600 19px Futura, Arial, sans-serif";
  context.fillText(`${question.section.toUpperCase()}${continued ? " - CONTINUED" : ""}`, MARGIN, 92);
  context.fillStyle = "#17212b";
  context.font = "600 42px Futura, Arial, sans-serif";
  const titleY = drawWrapped(context, `Q${question.number}  ${question.prompt}`, MARGIN, 126, PAGE_WIDTH - MARGIN * 2, 48);
  context.font = "500 18px PP Neue Montreal, Arial, sans-serif";
  context.fillStyle = "#5d6b78";
  const chartLabel = chartType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  context.fillText(`${chartLabel}  |  ${analysis.validResponses} valid responses`, MARGIN, titleY + 10);
  return titleY + 52;
}

function dataRows(question: Question, analysis: Analysis) {
  if (analysis.matrix.length) {
    return analysis.matrix.map((item) => ({
      label: item.label,
      value: item.normalized === null ? "No scored responses" : `${item.normalized.toFixed(1)}% normalized | mean ${item.mean?.toFixed(2)} | ${item.count} scored responses`
    }));
  }
  return optionOrder(question, analysis.categories).map((item) => ({
    label: item.label,
    value: `${item.count} of ${analysis.validResponses} responses (${item.percent.toFixed(1)}%)`
  }));
}

function drawDataRows(context: CanvasRenderingContext2D, rows: { label: string; value: string }[], startY: number, accent: string) {
  let y = startY;
  context.font = "600 21px Futura, Arial, sans-serif";
  context.fillStyle = "#17212b";
  context.fillText("Full data", MARGIN, y);
  y += 38;
  const remaining: typeof rows = [];
  rows.forEach((row) => {
    context.font = "500 17px PP Neue Montreal, Arial, sans-serif";
    const labelLines = linesFor(context, row.label, 690);
    const height = Math.max(34, labelLines.length * 23 + 12);
    if (y + height > PAGE_HEIGHT - 90) {
      remaining.push(row);
      return;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(MARGIN, y - 5, PAGE_WIDTH - MARGIN * 2, height);
    context.fillStyle = "#25333d";
    drawLines(context, labelLines, MARGIN + 16, y + 5, 23);
    context.fillStyle = accent;
    context.font = "700 16px PP Neue Montreal, Arial, sans-serif";
    context.textAlign = "right";
    context.fillText(row.value, PAGE_WIDTH - MARGIN - 16, y + 6);
    context.textAlign = "left";
    y += height + 4;
  });
  return remaining;
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
  cover.context.fillStyle = "#17212b";
  cover.context.font = "600 68px Futura, Arial, sans-serif";
  let coverY = drawWrapped(cover.context, "SGP Survey Explorer", MARGIN, 250, PAGE_WIDTH - MARGIN * 2, 78);
  cover.context.font = "500 31px PP Neue Montreal, Arial, sans-serif";
  cover.context.fillStyle = "#53616b";
  coverY = drawWrapped(cover.context, "Complete results across all stakeholder tabs", MARGIN, coverY + 24, PAGE_WIDTH - MARGIN * 2, 42);
  cover.context.font = "600 22px Futura, Arial, sans-serif";
  cover.context.fillStyle = "#3f7e44";
  cover.context.fillText(`${manifest.totalQuestions} questions | ${manifest.totalRespondents} survey records`, MARGIN, coverY + 44);
  cover.context.font = "400 19px PP Neue Montreal, Arial, sans-serif";
  cover.context.fillStyle = "#5d6b78";
  cover.context.fillText(`Generated ${new Date().toLocaleString()}`, MARGIN, coverY + 88);
  addPage(cover.canvas);

  let completedQuestions = 0;
  for (const group of manifest.groups) {
    onProgress?.(`Loading ${group.label}...`);
    const response = await fetch(`${baseUrl}data/${dataMode}/${slug(group.key)}.json?v=${encodeURIComponent(manifest.schemaVersion)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${group.label} data (${response.status}).`);
    const bundle = await response.json() as DataBundle;
    const sectionNames = [...new Set(group.questions.map((question) => question.section))];

    for (const question of group.questions) {
      completedQuestions++;
      onProgress?.(`Preparing Q${question.number} - ${completedQuestions} of ${manifest.totalQuestions}`);
      const analysis = analyzeQuestion(bundle.respondents, question, dataMode === "public" ? (bundle.suppressionThreshold ?? 5) : 0);
      const chosen = chartSelections[question.id];
      const compatible = availableChartTypes(question, analysis.categories.length);
      const chartType = chosen && compatible.includes(chosen) ? chosen : question.chart.default;
      const sectionIndex = sectionNames.indexOf(question.section);
      const accent = sectionChartPalette(group.key, sectionIndex)[0];

      if (question.kind === "qualitative" || chartType === "response_reader") {
        const responses = approvedResponses(bundle.respondents, question, dataMode);
        let responseIndex = 0;
        let continuation = false;
        do {
          const page = makePage();
          drawPageChrome(page.context, accent, group.label, `Q${question.number}`);
          let y = drawQuestionHeading(page.context, question, analysis, chartType, accent, continuation) + 12;
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
            const cardHeight = shown.length * 27 + 52;
            page.context.fillStyle = "#ffffff";
            page.context.fillRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, cardHeight);
            page.context.fillStyle = accent;
            page.context.font = "600 15px Futura, Arial, sans-serif";
            page.context.fillText(`RESPONSE ${responseIndex + 1}`, MARGIN + 19, y + 16);
            page.context.fillStyle = "#25333d";
            page.context.font = "400 18px PP Neue Montreal, Arial, sans-serif";
            drawLines(page.context, shown, MARGIN + 19, y + 42, 27);
            y += cardHeight + 12;
            responseIndex++;
          }
          addPage(page.canvas);
          continuation = true;
        } while (responseIndex < responses.length);
      } else {
        const page = makePage();
        drawPageChrome(page.context, accent, group.label, `Q${question.number}`);
        const contentY = drawQuestionHeading(page.context, question, analysis, chartType, accent);
        if (analysis.suppressed) {
          page.context.font = "500 23px PP Neue Montreal, Arial, sans-serif";
          page.context.fillStyle = "#53616b";
          page.context.fillText("Results are suppressed for this public view.", MARGIN, contentY + 70);
        } else if (chartType !== "data_table") {
          const chartUrl = await renderChart(question, analysis, chartType, group.key, sectionIndex);
          const chartImage = await imageFromUrl(chartUrl);
          page.context.fillStyle = "#ffffff";
          page.context.fillRect(MARGIN, contentY + 10, PAGE_WIDTH - MARGIN * 2, 700);
          page.context.drawImage(chartImage, MARGIN + 10, contentY + 20, PAGE_WIDTH - MARGIN * 2 - 20, 680);
        }
        let remaining = drawDataRows(page.context, dataRows(question, analysis), chartType === "data_table" ? contentY + 20 : contentY + 735, accent);
        addPage(page.canvas);
        while (remaining.length) {
          const continued = makePage();
          drawPageChrome(continued.context, accent, group.label, `Q${question.number}`);
          const continuedY = drawQuestionHeading(continued.context, question, analysis, chartType, accent, true);
          const next = drawDataRows(continued.context, remaining, continuedY + 20, accent);
          if (next.length === remaining.length) throw new Error(`Could not lay out Q${question.number} data.`);
          remaining = next;
          addPage(continued.canvas);
        }
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
