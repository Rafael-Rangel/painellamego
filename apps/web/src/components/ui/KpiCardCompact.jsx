export default function KpiCardCompact({ label, value, hint, trend }) {
  const trendClass = trend?.type === "up" ? "badge badge-success" : trend?.type === "down" ? "badge badge-danger" : "badge badge-info";
  return (
    <article className="stat stat-compact">
      <span>{label}</span>
      <strong>{value}</strong>
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "4px" }}>
        {trend?.label ? <span className={trendClass}>{trend.label}</span> : null}
        {hint ? <span className="subtitle">{hint}</span> : null}
      </div>
    </article>
  );
}
