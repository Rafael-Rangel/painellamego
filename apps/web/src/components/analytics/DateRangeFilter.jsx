import TableToolbar from "../ui/TableToolbar";

const PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "thisMonth", label: "Este mês" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "custom", label: "Personalizado" }
];

export default function DateRangeFilter({ filters, onChange }) {
  const isCustom = filters.preset === "custom";

  return (
    <TableToolbar className="analytics-filter-toolbar">
      <div className="field span-12 analytics-preset-row">
        <label>Período</label>
        <div className="analytics-preset-chips">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn-sm ${filters.preset === p.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onChange({ preset: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isCustom ? (
        <>
          <div className="field span-3">
            <label>Data inicial</label>
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(e) => onChange({ dateFrom: e.target.value, preset: "custom" })}
            />
          </div>
          <div className="field span-3">
            <label>Data final</label>
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(e) => onChange({ dateTo: e.target.value, preset: "custom" })}
            />
          </div>
        </>
      ) : null}
      <div className="field span-3">
        <label>Agrupamento</label>
        <select value={filters.granularity || "month"} onChange={(e) => onChange({ granularity: e.target.value })}>
          <option value="day">Diário</option>
          <option value="week">Semanal</option>
          <option value="month">Mensal</option>
        </select>
      </div>
    </TableToolbar>
  );
}
