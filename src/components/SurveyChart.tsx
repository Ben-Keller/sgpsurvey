import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ECharts, EChartsOption } from "echarts";
import type { Analysis, ChartType, Question } from "../types";
import { optionOrder } from "../lib/analysis";
import { sectionChartPalette } from "../lib/sectionAccent";

export function wrapChartLabel(value: string, maxCharacters: number, maxLines: number) {
  if (value.length <= maxCharacters) return value;
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let wordIndex = 0;

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      current = candidate;
      wordIndex += 1;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
      continue;
    }
    lines.push(word.length > maxCharacters ? `${word.slice(0, Math.max(1, maxCharacters - 1))}…` : word);
    wordIndex += 1;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const omitted = wordIndex < words.length;
  if (omitted && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].replace(/…$/, "").slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
  }
  return lines.join("\n");
}

type LabelViewport = "desktop" | "mobile" | "export";

export function chartLabelLayout(itemCount: number, viewport: LabelViewport) {
  if (viewport === "export") return { axisWidth: 340, gridLeft: 360, maxCharacters: 46, maxLines: 1, fontSize: 13, lineHeight: 16 };
  if (viewport === "mobile") {
    if (itemCount <= 5) return { axisWidth: 126, gridLeft: 140, maxCharacters: 19, maxLines: 4, fontSize: 10, lineHeight: 12 };
    if (itemCount <= 9) return { axisWidth: 118, gridLeft: 132, maxCharacters: 18, maxLines: 3, fontSize: 9.5, lineHeight: 12 };
    if (itemCount <= 14) return { axisWidth: 110, gridLeft: 124, maxCharacters: 17, maxLines: 2, fontSize: 9.5, lineHeight: 12 };
    return { axisWidth: 104, gridLeft: 118, maxCharacters: 16, maxLines: 1, fontSize: 9, lineHeight: 11 };
  }
  if (itemCount <= 5) return { axisWidth: 260, gridLeft: 278, maxCharacters: 38, maxLines: 4, fontSize: 12, lineHeight: 16 };
  if (itemCount <= 9) return { axisWidth: 244, gridLeft: 262, maxCharacters: 35, maxLines: 3, fontSize: 12, lineHeight: 15 };
  if (itemCount <= 14) return { axisWidth: 220, gridLeft: 238, maxCharacters: 31, maxLines: 2, fontSize: 11.5, lineHeight: 14 };
  return { axisWidth: 205, gridLeft: 220, maxCharacters: 28, maxLines: 1, fontSize: 11, lineHeight: 14 };
}

export function positionChartTooltip(point: number[], size: { contentSize: number[]; viewSize: number[] }) {
  const edge = 8;
  const gap = 12;
  const [pointerX = 0, pointerY = 0] = point;
  const [contentWidth = 0, contentHeight = 0] = size.contentSize;
  const [viewWidth = 0, viewHeight = 0] = size.viewSize;
  const maximumX = Math.max(edge, viewWidth - contentWidth - edge);
  const x = Math.max(edge, Math.min(pointerX + gap, maximumX));
  const preferredY = pointerY + gap;
  const aboveY = pointerY - contentHeight - gap;
  const maximumY = Math.max(edge, viewHeight - contentHeight - edge);
  const y = Math.max(edge, Math.min(preferredY + contentHeight <= viewHeight - edge ? preferredY : aboveY, maximumY));
  return [Math.round(x), Math.round(y)];
}

export function makeChartOption(question: Question, analysis: Analysis, chart: ChartType, groupKey: string, sectionIndex: number, exportMode = false): EChartsOption {
  const palette = sectionChartPalette(groupKey, sectionIndex);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const motion = exportMode || reduceMotion
    ? { animation: false, textStyle: { fontFamily: "PP Neue Montreal, Arial, sans-serif" } }
    : {
        animation: true,
        animationDuration: 720,
        animationEasing: "cubicOut" as const,
        animationDelay: (index: number) => Math.min(index * 28, 224),
        animationDurationUpdate: 0,
        textStyle: { fontFamily: "PP Neue Montreal, Arial, sans-serif" }
      };
  const ordered = optionOrder(question, analysis.categories);
  const labels = ordered.map((item) => item.label);
  const values = ordered.map((item) => Number(item.percent.toFixed(1)));
  const tooltipSurface = {
    confine: true,
    triggerOn: "mousemove|click|mousewheel" as const,
    showDelay: 35,
    hideDelay: 180,
    transitionDuration: .12,
    position: positionChartTooltip as any,
    backgroundColor: "rgba(23,33,43,.96)",
    borderWidth: 0,
    padding: [10, 12],
    textStyle: { color: "#ffffff", fontFamily: "PP Neue Montreal, Arial, sans-serif", fontSize: 13, lineHeight: 18 },
    extraCssText: "max-width:280px;white-space:normal;overflow-wrap:anywhere;border-radius:9px;box-shadow:0 8px 24px rgba(23,33,43,.22);"
  };
  const tooltip = {
    ...tooltipSurface,
    trigger: "item" as const,
    formatter: (params: any) => {
      const item = ordered[params.dataIndex];
      return item ? `<strong>${item.label}</strong><br/>${item.count} of ${analysis.validResponses} responses · ${item.percent.toFixed(1)}%` : "";
    }
  };

  if (chart === "radar") {
    const radarLabel = (label: string, viewport: LabelViewport) => viewport === "export"
      ? wrapChartLabel(label, 28, 1)
      : wrapChartLabel(label, viewport === "mobile" ? 15 : 23, 2);
    return {
      ...motion,
      color: [palette[0]],
      tooltip: {
        show: false,
        triggerOn: "none"
      },
      radar: {
        radius: "62%",
        triggerEvent: true,
        indicator: analysis.matrix.map((item) => ({ name: exportMode ? `${radarLabel(item.label, "export")} ${(item.normalized ?? 0).toFixed(1)}%` : radarLabel(item.label, "desktop"), max: 100 })),
        axisName: { color: "#33424d", fontSize: exportMode ? 13 : 11 },
        splitArea: { areaStyle: { color: ["#fafaf6", "#f0f2ec"] } },
        splitLine: { lineStyle: { color: "#dde2dc" } }
      },
      series: [{ type: "radar", symbolSize: 6, areaStyle: { opacity: 0.2 }, data: [{ value: analysis.matrix.map((item) => item.normalized ?? 0) }] }],
      media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { radar: { radius: "43%", center: ["50%", "48%"], axisName: { fontSize: 9, lineHeight: 11 }, indicator: analysis.matrix.map((item) => ({ name: radarLabel(item.label, "mobile"), max: 100 })) } } }]
    };
  }

  if (chart === "heatmap" || chart === "diverging_stacked") {
    const distributionLabels = [...new Set(analysis.matrix.flatMap((item) => Object.keys(item.distribution)))];
    const matrixDesktopLabels = chartLabelLayout(analysis.matrix.length, "desktop");
    const matrixMobileLabels = chartLabelLayout(analysis.matrix.length, "mobile");
    return {
      ...motion,
      tooltip: chart === "diverging_stacked" ? { ...tooltipSurface, trigger: "axis", axisPointer: { type: "shadow" } } : { ...tooltipSurface, trigger: "item" },
      grid: { top: 20, left: matrixDesktopLabels.gridLeft, right: 30, bottom: 80 },
      xAxis: { type: "category", data: distributionLabels, axisLabel: { rotate: 25 } },
      yAxis: { type: "category", triggerEvent: chart === "diverging_stacked", data: analysis.matrix.map((item) => item.label), axisLabel: { width: matrixDesktopLabels.axisWidth, fontSize: matrixDesktopLabels.fontSize, lineHeight: matrixDesktopLabels.lineHeight, overflow: "truncate", formatter: (value: string) => wrapChartLabel(value, matrixDesktopLabels.maxCharacters, matrixDesktopLabels.maxLines) } },
      visualMap: chart === "heatmap" ? { min: 0, max: Math.max(1, ...analysis.matrix.flatMap((item) => Object.values(item.distribution))), calculable: true, orient: "horizontal", bottom: 5, left: "center", inRange: { color: ["#f4f4ee", palette[0]] } } : undefined,
      series:
        chart === "heatmap"
          ? [{ type: "heatmap", data: analysis.matrix.flatMap((item, y) => distributionLabels.map((label, x) => [x, y, item.distribution[label] ?? 0])), label: { show: true } }]
          : distributionLabels.map((label, index) => ({ name: label, type: "bar", stack: "total", data: analysis.matrix.map((item) => item.distribution[label] ?? 0), itemStyle: { color: palette[index % palette.length] }, label: exportMode ? { show: true, formatter: (params: any) => params.value ? String(params.value) : "" } : undefined })),
      media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { grid: { top: 22, left: matrixMobileLabels.gridLeft, right: 12, bottom: 96 }, xAxis: { axisLabel: { rotate: 35, fontSize: 9 } }, yAxis: { axisLabel: { width: matrixMobileLabels.axisWidth, fontSize: matrixMobileLabels.fontSize, lineHeight: matrixMobileLabels.lineHeight, overflow: "truncate", formatter: (value: string) => wrapChartLabel(value, matrixMobileLabels.maxCharacters, matrixMobileLabels.maxLines) } }, visualMap: chart === "heatmap" ? { itemWidth: 12, itemHeight: 100, textStyle: { fontSize: 9 } } : undefined } }]
    };
  }

  if (chart === "donut") {
    const donutLabel = (name: string, mobile: boolean) => wrapChartLabel(name, mobile ? 15 : 22, ordered.length <= 6 ? 2 : 1);
    return {
      ...motion,
      color: palette,
      tooltip,
      legend: { type: "plain", orient: "horizontal", left: 24, right: 24, bottom: 8, itemWidth: 13, itemHeight: 13, itemGap: 16, formatter: exportMode ? undefined : (name: string) => donutLabel(name, false) },
      series: [{ type: "pie", animationType: "scale", animationTypeUpdate: "transition", radius: ["44%", "68%"], center: ["50%", "40%"], label: { lineHeight: 15, formatter: exportMode ? "{b}: {c} ({d}%)" : (params: any) => `${donutLabel(params.name, false)}\n${params.percent}%` }, data: ordered.map((item) => ({ name: item.label, value: item.count })) }],
      media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { legend: { left: 10, right: 10, bottom: 8, itemWidth: 10, itemHeight: 10, itemGap: 9, formatter: (name: string) => donutLabel(name, true), textStyle: { fontSize: 10, lineHeight: 12 } }, series: [{ radius: ["34%", "54%"], center: ["50%", "33%"], label: { fontSize: 10, lineHeight: 12, formatter: (params: any) => `${donutLabel(params.name, true)}\n${params.percent}%` } }] } }]
    };
  }

  if (chart === "treemap") {
    const treemapFormatter = (mobile: boolean) => (params: any) => wrapChartLabel(params.data?.surveyLabel ?? params.name ?? "", mobile ? 14 : 20, ordered.length <= 8 ? 3 : 2);
    const treemapLabel = { show: true, color: "#ffffff", fontSize: exportMode ? 14 : 12, lineHeight: exportMode ? 17 : 15, fontWeight: 700, textBorderColor: "rgba(0,0,0,.42)", textBorderWidth: 2, overflow: "truncate" as const, formatter: exportMode ? "{b}" : treemapFormatter(false) };
    const treemapMobileLabel = { ...treemapLabel, fontSize: 10, lineHeight: 12, formatter: treemapFormatter(true) };
    const treemapData = ordered.map((item) => ({
      name: exportMode ? `${item.label} - ${item.count}` : item.label,
      value: item.count,
      surveyLabel: item.label,
      responseCount: item.count,
      responsePercent: item.percent,
      responseBase: analysis.validResponses
    }));
    const treemapTooltip = {
      ...tooltipSurface,
      trigger: "item" as const,
      formatter: (params: any) => {
        const node = params.data as typeof treemapData[number] | undefined;
        if (!node || typeof node.responseCount !== "number") return "";
        return `<strong>${node.surveyLabel}</strong><br/>${node.responseCount} of ${node.responseBase} responses · ${node.responsePercent.toFixed(1)}%`;
      }
    };
    return { ...motion, color: palette, tooltip: treemapTooltip, series: [{ type: "treemap", roam: false, breadcrumb: { show: false }, label: treemapLabel, upperLabel: treemapLabel, levels: [{ label: treemapLabel, upperLabel: treemapLabel }, { label: treemapLabel, upperLabel: treemapLabel }], data: treemapData }], media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { series: [{ label: treemapMobileLabel, upperLabel: treemapMobileLabel, levels: [{ label: treemapMobileLabel, upperLabel: treemapMobileLabel }, { label: treemapMobileLabel, upperLabel: treemapMobileLabel }] }] } }] };
  }

  const matrixBars = analysis.matrix.length
    ? [...analysis.matrix].sort((a, b) => (b.normalized ?? -1) - (a.normalized ?? -1))
    : null;
  const barLabels = matrixBars?.map((item) => item.label) ?? labels;
  const barValues = matrixBars?.map((item) => Number((item.normalized ?? 0).toFixed(1))) ?? values;
  const desktopLabels = chartLabelLayout(barLabels.length, exportMode ? "export" : "desktop");
  const mobileLabels = chartLabelLayout(barLabels.length, "mobile");
  const isDot = chart === "lollipop" || chart === "dot_plot";
  const barTooltip = {
    ...tooltipSurface,
    trigger: "item" as const,
    formatter: (params: any) => {
      if (matrixBars) {
        const item = matrixBars[params.dataIndex];
        return item ? `<strong>${item.label}</strong><br/>Normalized score: ${(item.normalized ?? 0).toFixed(1)}%<br/>${item.count} of ${analysis.validResponses} scored responses` : "";
      }
      const item = ordered[params.dataIndex];
      return item ? `<strong>${item.label}</strong><br/>${item.count} of ${analysis.validResponses} responses · ${item.percent.toFixed(1)}%` : "";
    }
  };
  return {
    ...motion,
    color: [palette[0]],
    tooltip: barTooltip,
    grid: { top: 12, right: 65, bottom: 35, left: desktopLabels.gridLeft, containLabel: false },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { color: "#e5e8e1" } } },
    yAxis: { type: "category", inverse: true, triggerEvent: true, data: barLabels, axisLabel: { color: "#33424d", width: desktopLabels.axisWidth, fontSize: desktopLabels.fontSize, lineHeight: desktopLabels.lineHeight, overflow: "truncate", formatter: (value: string) => wrapChartLabel(value, desktopLabels.maxCharacters, desktopLabels.maxLines) } },
    series: [{ type: "bar", data: barValues, barMaxWidth: isDot ? 5 : 26, showBackground: !isDot, backgroundStyle: { color: "#eeefe9" }, itemStyle: { borderRadius: 5 }, label: { show: true, position: "right", formatter: exportMode && !matrixBars ? (params: any) => { const item = ordered[params.dataIndex]; return item ? `${item.count} (${item.percent.toFixed(1)}%)` : ""; } : "{c}%" } }],
    media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { grid: { top: 16, right: 46, bottom: 34, left: mobileLabels.gridLeft }, xAxis: { axisLabel: { fontSize: 9 } }, yAxis: { axisLabel: { width: mobileLabels.axisWidth, fontSize: mobileLabels.fontSize, lineHeight: mobileLabels.lineHeight, overflow: "truncate", formatter: (value: string) => wrapChartLabel(value, mobileLabels.maxCharacters, mobileLabels.maxLines) } }, series: [{ label: { fontSize: 9 } }] } }]
  };
}

export function SurveyChart({ question, analysis, chart, groupKey, sectionIndex, onReady }: { question: Question; analysis: Analysis; chart: ChartType; groupKey: string; sectionIndex: number; onReady?: (chart: ECharts) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ECharts | null>(null);
  const optionRef = useRef<EChartsOption | null>(null);
  const chartRef = useRef(chart);
  const analysisRef = useRef(analysis);
  const radarLabelHover = useRef(false);
  const onReadyRef = useRef(onReady);
  const readyFrame = useRef(0);
  const introTimer = useRef(0);
  const [readyChart, setReadyChart] = useState<ChartType | null>(null);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [radarTooltip, setRadarTooltip] = useState<{ x: number; y: number; label: string; value: number | null } | null>(null);
  const option = useMemo(() => makeChartOption(question, analysis, chart, groupKey, sectionIndex), [question, analysis, chart, groupKey, sectionIndex]);

  useEffect(() => {
    optionRef.current = option;
    chartRef.current = chart;
    analysisRef.current = analysis;
  }, [option, chart, analysis]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let disposed = false;
    let resizeFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let viewportObserver: IntersectionObserver | undefined;
    let resizeHandler: (() => void) | undefined;
    const initialize = () => void import("echarts").then((echarts) => {
      if (disposed || !host.current) return;
      const chartInstance = echarts.init(host.current, undefined, { renderer: "canvas" });
      instance.current = chartInstance;
      chartInstance.setOption(optionRef.current ?? {}, { notMerge: true, lazyUpdate: true });
      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      setIntroPlaying(!reduceMotion);
      window.clearTimeout(introTimer.current);
      introTimer.current = window.setTimeout(() => setIntroPlaying(false), reduceMotion ? 20 : 980);
      const showAxisLabelTooltip = (params: any) => {
        if (params.componentType !== "yAxis" || params.targetType !== "axisLabel") return;
        const currentOption = chartInstance.getOption() as any;
        const axes = Array.isArray(currentOption.yAxis) ? currentOption.yAxis : [currentOption.yAxis];
        const axis = axes[params.componentIndex ?? 0];
        const data = axis?.data ?? [];
        const dataIndex = data.findIndex((entry: any) => (typeof entry === "object" ? entry?.value : entry) === params.value);
        if (dataIndex >= 0) chartInstance.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex });
      };
      const hideAxisLabelTooltip = (params: any) => {
        if (params.componentType === "yAxis" && params.targetType === "axisLabel") chartInstance.dispatchAction({ type: "hideTip" });
      };
      const showRadarLabelTooltip = (params: any) => {
        const name = String(params.target?.style?.text ?? params.target?.parent?.style?.text ?? "");
        const item = analysisRef.current.matrix.find((candidate) => candidate.label === name || (candidate.label.length > 25 ? `${candidate.label.slice(0, 23)}…` : candidate.label) === name || (candidate.label.length > 18 ? `${candidate.label.slice(0, 16)}…` : candidate.label) === name);
        if (!item || chartRef.current !== "radar" || !host.current) {
          if (radarLabelHover.current) {
            radarLabelHover.current = false;
            setRadarTooltip(null);
          }
          return;
        }
        radarLabelHover.current = true;
        const rect = host.current.getBoundingClientRect();
        const pointerX = Number(params.offsetX ?? rect.width / 2);
        const pointerY = Number(params.offsetY ?? rect.height / 2);
        setRadarTooltip({ x: Math.max(8, Math.min(pointerX + 14, rect.width - 270)), y: Math.max(8, Math.min(pointerY + 14, rect.height - 105)), label: item.label, value: item.normalized });
      };
      chartInstance.on("mouseover", showAxisLabelTooltip);
      chartInstance.on("mouseout", hideAxisLabelTooltip);
      chartInstance.getZr().on("mousemove", showRadarLabelTooltip);
      onReadyRef.current?.(chartInstance);
      readyFrame.current = requestAnimationFrame(() => {
        readyFrame.current = requestAnimationFrame(() => setReadyChart(chartRef.current));
      });
      resizeHandler = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (!chartInstance.isDisposed()) chartInstance.resize({ animation: { duration: 0 } });
        });
      };
      window.addEventListener("resize", resizeHandler);
      resizeObserver = new ResizeObserver(resizeHandler);
      resizeObserver.observe(host.current);
    });
    if (host.current && "IntersectionObserver" in window) {
      viewportObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        viewportObserver?.disconnect();
        initialize();
      }, { rootMargin: "80px 0px", threshold: 0.08 });
      viewportObserver.observe(host.current);
    } else {
      initialize();
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(readyFrame.current);
      window.clearTimeout(introTimer.current);
      viewportObserver?.disconnect();
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      instance.current?.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!instance.current || instance.current.isDisposed()) return;
    setIntroPlaying(false);
    setReadyChart(null);
    instance.current.setOption({ ...option, animation: false }, { notMerge: true, lazyUpdate: true });
    cancelAnimationFrame(readyFrame.current);
    readyFrame.current = requestAnimationFrame(() => {
      readyFrame.current = requestAnimationFrame(() => setReadyChart(chart));
    });
  }, [option, chart]);

  const handleRadarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (chart !== "radar" || !analysis.matrix.length) {
      setRadarTooltip((current) => current ? null : current);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const centerX = rect.width * .5;
    const centerY = rect.height * .44;
    const radius = Math.min(rect.width, rect.height) * .26;
    if (radarLabelHover.current) return;
    let hovered: Analysis["matrix"][number] | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    analysis.matrix.forEach((item, index) => {
      const angle = Math.PI / 2 - (Math.PI * 2 * index) / analysis.matrix.length;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const valueRadius = radius * ((item.normalized ?? 0) / 100);
      const valueX = centerX + cos * valueRadius;
      const valueY = centerY - sin * valueRadius;
      const pointDistance = Math.hypot(pointerX - valueX, pointerY - valueY);

      if (pointDistance <= 18 && pointDistance < closestDistance) {
        hovered = item;
        closestDistance = pointDistance;
      }
    });

    if (!hovered) {
      setRadarTooltip((current) => current ? null : current);
      return;
    }
    const item = hovered as Analysis["matrix"][number];
    setRadarTooltip({
      x: Math.max(8, Math.min(pointerX + 14, rect.width - 270)),
      y: Math.max(8, Math.min(pointerY + 14, rect.height - 105)),
      label: item.label,
      value: item.normalized,
    });
  };

  const ready = readyChart === chart;
  return <div className={`chart-shell${introPlaying ? ` chart-intro chart-intro--${chart}` : ""}`} data-intro={introPlaying ? "playing" : "complete"} aria-busy={!ready} onPointerMove={handleRadarPointerMove} onPointerLeave={() => { radarLabelHover.current = false; setRadarTooltip(null); }}><div className="chart" ref={host} role="img" aria-label={`${question.prompt}. ${analysis.validResponses} valid responses shown as ${chart.replaceAll("_", " ")}.`} />{chart === "radar" && radarTooltip && <div className="radar-hover-tooltip" role="tooltip" style={{ left: radarTooltip.x, top: radarTooltip.y }}><strong>{radarTooltip.label}</strong><span className="radar-tooltip-value">{radarTooltip.value === null ? "—" : `${radarTooltip.value.toFixed(1)}%`}</span></div>}<div className="chart-loading" hidden={ready}><span />Updating visualization…</div></div>;
}
