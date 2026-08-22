import { useMemo, useState } from "react";
import type { Group, Respondent } from "../types";

export function Filters({ group, respondents, filters, onChange, onClose }: { group: Group; respondents: Respondent[]; filters: Record<string, string[]>; onChange: (filters: Record<string, string[]>) => void; onClose: () => void }) {
  const [search, setSearch] = useState<Record<string, string>>({});
  const options = useMemo(() => Object.fromEntries(group.filters.map((filter) => {
    const counts = new Map<string, number>();
    respondents.forEach((respondent) => {
      const value = respondent.dimensions[filter.key];
      const values = Array.isArray(value) ? value : value ? [value] : [];
      values.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    });
    return [filter.key, [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))];
  })), [group, respondents]);
  const toggle = (key: string, value: string) => {
    const current = filters[key] ?? [];
    onChange({ ...filters, [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  };

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filter-heading">
        <div className="drawer-heading"><div><div className="eyebrow">Refine this group</div><h2 id="filter-heading">Filters</h2></div><button className="icon-button" aria-label="Close filters" onClick={onClose}>×</button></div>
        {group.filters.map((filter) => {
          const query = (search[filter.key] ?? "").toLocaleLowerCase();
          const values = (options[filter.key] ?? []).filter(([value]: [string, number]) => value.toLocaleLowerCase().includes(query));
          return <fieldset key={filter.key}><legend>{filter.label}</legend>{(options[filter.key]?.length ?? 0) > 10 && <input aria-label={`Search ${filter.label}`} type="search" placeholder="Search options" value={search[filter.key] ?? ""} onChange={(event) => setSearch({ ...search, [filter.key]: event.target.value })} />}<div className="filter-options">{values.map(([value, count]: [string, number]) => <label key={value}><input type="checkbox" checked={(filters[filter.key] ?? []).includes(value)} onChange={() => toggle(filter.key, value)} /><span>{value}</span><small>{count}</small></label>)}</div></fieldset>;
        })}
        <div className="drawer-footer"><button onClick={() => onChange({})}>Reset all</button><button className="primary" onClick={onClose}>Show results</button></div>
      </aside>
    </div>
  );
}
