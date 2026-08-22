import type { ChartType } from "../types";

const labels: Record<ChartType, string> = { ranked_bar: "Ranked bar", ordered_bar: "Ordered bar", diverging_bar: "Diverging bar", diverging_stacked: "Diverging stacked", lollipop: "Lollipop", dot_plot: "Dot plot", donut: "Donut", treemap: "Treemap", world_map: "World map", radar: "Radar", heatmap: "Heatmap", data_table: "Data table", response_reader: "Response reader" };

export function ChartSwitcher({ charts, value, onChange }: { charts: ChartType[]; value: ChartType; onChange: (chart: ChartType) => void }) {
  const index = Math.max(0, charts.indexOf(value));
  const move = (offset: number) => onChange(charts[(index + offset + charts.length) % charts.length]);
  return <div className="chart-switcher"><button className="icon-button" aria-label="Previous chart" onClick={() => move(-1)}>←</button><label><span className="sr-only">Chart type</span><select value={value} onChange={(event) => onChange(event.target.value as ChartType)}>{charts.map((chart) => <option key={chart} value={chart}>{labels[chart]}</option>)}</select></label><button className="icon-button" aria-label="Next chart" onClick={() => move(1)}>→</button></div>;
}
