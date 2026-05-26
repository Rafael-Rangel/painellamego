import { formatCurrency } from "../../lib/formatters";
import { formatPercent } from "../../lib/analyticsFormatters";

export default function DeltaBadge({ direction, percent, amount, compact = false }) {
  if (direction === "flat" && !percent) return <span className="delta-badge delta-badge--flat">—</span>;
  const cls =
    direction === "up" ? "delta-badge delta-badge--up" : direction === "down" ? "delta-badge delta-badge--down" : "delta-badge delta-badge--flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  if (compact) {
    return (
      <span className={cls}>
        {arrow} {formatPercent(percent)}
      </span>
    );
  }
  return (
    <span className={cls}>
      {arrow} {formatPercent(percent)}
      {amount != null ? ` (${formatCurrency(amount)})` : null}
    </span>
  );
}
