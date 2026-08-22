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

export function makeChartOption(question: Question, analysis: Analysis, chart: ChartType, groupKey: string, sectionIndex: number, exportMode = false): EChartsOption {
  const palette = sectionChartPalette(groupKey, sectionIndex);
  const motion = { animation: false, textStyle: { fontFamily: "PP Neue Montreal, Arial, sans-serif" } } as const;
  const ordered = optionOrder(question, analysis.categories);
  const labels = ordered.map((item) => item.label);
  const values = ordered.map((item) => Number(item.percent.toFixed(1)));
  const tooltip = {
    trigger: "item" as const,
    formatter: (params: any) => {
      const item = ordered[params.dataIndex];
      return item ? `<strong>${item.label}</strong><br/>${item.count} of ${analysis.validResponses} responses · ${item.percent.toFixed(1)}%` : "";
    }
  };

  if (chart === "radar") {
    return {
      ...motion,
      color: [palette[0]],
      tooltip: {
        trigger: "item",
        formatter: () => `Normalized mean score · n=${analysis.validResponses}`
      },
      radar: {
        radius: "62%",
        triggerEvent: true,
        indicator: analysis.matrix.map((item) => ({ name: exportMode ? `${item.label}\n${(item.normalized ?? 0).toFixed(1)}%` : item.label.length > 25 ? `${item.label.slice(0, 23)}…` : item.label, max: 100 })),
        axisName: { color: "#33424d", fontSize: exportMode ? 13 : 11 },
        splitArea: { areaStyle: { color: ["#fafaf6", "#f0f2ec"] } },
        splitLine: { lineStyle: { color: "#dde2dc" } }
      },
      series: [{ type: "radar", symbolSize: 6, areaStyle: { opacity: 0.2 }, data: [{ value: analysis.matrix.map((item) => item.normalized ?? 0) }] }],
      media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { radar: { radius: "45%", center: ["50%", "48%"], axisName: { fontSize: 9, formatter: (name: string) => name.length > 18 ? `${name.slice(0, 16)}…` : name } } } }]
    };
  }

  if (chart === "heatmap" || chart === "diverging_stacked") {
    const distributionLabels = [...new Set(analysis.matrix.flatMap((item) => Object.keys(item.distribution)))];
    return {
      ...motion,
      tooltip: chart === "diverging_stacked" ? { trigger: "axis", axisPointer: { type: "shadow" } } : { position: "top" },
      grid: { top: 20, left: 190, right: 30, bottom: 80 },
      xAxis: { type: "category", data: distributionLabels, axisLabel: { rotate: 25 } },
      yAxis: { type: "category", triggerEvent: chart === "diverging_stacked", data: analysis.matrix.map((item) => item.label), axisLabel: { width: 175, overflow: "truncate" } },
      visualMap: chart === "heatmap" ? { min: 0, max: Math.max(1, ...analysis.matrix.flatMap((item) => Object.values(item.distribution))), calculable: true, orient: "horizontal", bottom: 5, left: "center", inRange: { color: ["#f4f4ee", palette[0]] } } : undefined,
      series:
        chart === "heatmap"
          ? [{ type: "heatmap", data: analysis.matrix.flatMap((item, y) => distributionLabels.map((label, x) => [x, y, item.distribution[label] ?? 0])), label: { show: true } }]
          : distributionLabels.map((label, index) => ({ name: label, type: "bar", stack: "total", data: analysis.matrix.map((item) => item.distribution[label] ?? 0), itemStyle: { color: palette[index % palette.length] }, label: exportMode ? { show: true, formatter: (params: any) => params.value ? String(params.value) : "" } : undefined })),
      media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { grid: { top: 22, left: 118, right: 12, bottom: 96 }, xAxis: { axisLabel: { rotate: 35, fontSize: 9 } }, yAxis: { axisLabel: { width: 106, fontSize: 9, overflow: "truncate" } }, visualMap: chart === "heatmap" ? { itemWidth: 12, itemHeight: 100, textStyle: { fontSize: 9 } } : undefined } }]
    };
  }

  if (chart === "donut") {
    return {
      ...motion,
      color: palette,
      tooltip,
      legend: { type: "plain", orient: "horizontal", left: 24, right: 24, bottom: 8, itemWidth: 13, itemHeight: 13, itemGap: 16 },
      series: [{ type: "pie", radius: ["44%", "68%"], center: ["50%", "40%"], label: { formatter: exportMode ? "{b}\n{c} ({d}%)" : "{b}\n{d}%" }, data: ordered.map((item) => ({ name: item.label, value: item.count })) }],
      media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { legend: { left: 10, right: 10, bottom: 8, itemWidth: 10, itemHeight: 10, itemGap: 9, textStyle: { fontSize: 10 } }, series: [{ radius: ["34%", "56%"], center: ["50%", "34%"], label: { fontSize: 10 } }] } }]
    };
  }

  if (chart === "treemap") {
    const treemapLabel = { show: true, color: "#ffffff", fontSize: exportMode ? 14 : 12, fontWeight: 700, textBorderColor: "rgba(0,0,0,.42)", textBorderWidth: 2, overflow: "break" as const, formatter: "{b}" };
    return { ...motion, color: palette, tooltip, series: [{ type: "treemap", roam: false, breadcrumb: { show: false }, label: treemapLabel, upperLabel: treemapLabel, levels: [{ label: treemapLabel, upperLabel: treemapLabel }, { label: treemapLabel, upperLabel: treemapLabel }], data: ordered.map((item) => ({ name: exportMode ? `${item.label} - ${item.count}` : item.label, value: item.count })) }] };
  }

  const matrixBars = analysis.matrix.length
    ? [...analysis.matrix].sort((a, b) => (b.normalized ?? -1) - (a.normalized ?? -1))
    : null;
  const barLabels = matrixBars?.map((item) => item.label) ?? labels;
  const barValues = matrixBars?.map((item) => Number((item.normalized ?? 0).toFixed(1))) ?? values;
  const desktopLabelLines = barLabels.length <= 7 ? 3 : barLabels.length <= 12 ? 2 : 1;
  const mobileLabelLines = barLabels.length <= 6 ? 3 : barLabels.length <= 10 ? 2 : 1;
  const isDot = chart === "lollipop" || chart === "dot_plot";
  const barTooltip = {
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
    grid: { top: 12, right: 65, bottom: 35, left: 220, containLabel: false },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { color: "#e5e8e1" } } },
    yAxis: { type: "category", inverse: true, triggerEvent: true, data: barLabels, axisLabel: { color: "#33424d", width: 205, lineHeight: 14, overflow: "truncate", formatter: (value: string) => wrapChartLabel(value, exportMode ? 34 : 30, desktopLabelLines) } },
    series: [{ type: "bar", data: barValues, barMaxWidth: isDot ? 5 : 26, showBackground: !isDot, backgroundStyle: { color: "#eeefe9" }, itemStyle: { borderRadius: 5 }, label: { show: true, position: "right", formatter: exportMode && !matrixBars ? (params: any) => { const item = ordered[params.dataIndex]; return item ? `${item.count} (${item.percent.toFixed(1)}%)` : ""; } : "{c}%" } }],
    media: exportMode ? undefined : [{ query: { maxWidth: 520 }, option: { grid: { top: 16, right: 46, bottom: 34, left: 116 }, xAxis: { axisLabel: { fontSize: 9 } }, yAxis: { axisLabel: { width: 104, fontSize: 9.5, lineHeight: 12, overflow: "truncate", formatter: (value: string) => wrapChartLabel(value, 17, mobileLabelLines) } }, series: [{ label: { fontSize: 9 } }] } }]
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
  const [readyChart, setReadyChart] = useState<ChartType | null>(null);
  const [radarTooltip, setRadarTooltip] = useState<{ x: number; y: number; label: string; normalized: number | null; mean: number | null; count: number } | null>(null);
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
    let resizeHandler: (() => void) | undefined;
    void import("echarts").then((echarts) => {
      if (disposed || !host.current) return;
      const chartInstance = echarts.init(host.current, undefined, { renderer: "canvas" });
      instance.current = chartInstance;
      chartInstance.setOption(optionRef.current ?? {}, { notMerge: true, lazyUpdate: true });
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
        setRadarTooltip({ x: Math.min(pointerX + 14, rect.width - 270), y: Math.max(8, Math.min(pointerY + 14, rect.height - 105)), label: item.label, normalized: item.normalized, mean: item.mean, count: item.count });
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
    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(readyFrame.current);
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      instance.current?.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!instance.current || instance.current.isDisposed()) return;
    instance.current.setOption(option, { notMerge: true, lazyUpdate: true });
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
      x: Math.min(pointerX + 14, rect.width - 270),
      y: Math.max(8, Math.min(pointerY + 14, rect.height - 105)),
      label: item.label,
      normalized: item.normalized,
      mean: item.mean,
      count: item.count,
    });
  };

  const ready = readyChart === chart;
  return <div className="chart-shell" aria-busy={!ready} onPointerMove={handleRadarPointerMove} onPointerLeave={() => { radarLabelHover.current = false; setRadarTooltip(null); }}><div className="chart" ref={host} role="img" aria-label={`${question.prompt}. ${analysis.validResponses} valid responses shown as ${chart.replaceAll("_", " ")}.`} />{chart === "radar" && radarTooltip && <div className="radar-hover-tooltip" role="tooltip" style={{ left: radarTooltip.x, top: radarTooltip.y }}><strong>{radarTooltip.label}</strong>{radarTooltip.normalized === null ? <span>No scored responses</span> : <><span>Normalized score: {radarTooltip.normalized.toFixed(1)}%</span><span>Mean: {radarTooltip.mean?.toFixed(2)} · {radarTooltip.count} scored responses</span></>}</div>}<div className="chart-loading" hidden={ready}><span />Updating visualization…</div></div>;
}
