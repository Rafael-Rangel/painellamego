export function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}%`;
}

export function formatQty(value, unit = "") {
  const n = Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unit ? `${n} ${unit}` : n;
}

export function bucketLabel(label, granularity) {
  if (!label) return "";
  if (granularity === "month" && /^\d{4}-\d{2}$/.test(label)) {
    const [y, mo] = label.split("-");
    return new Date(Number(y, 10), Number(mo, 10) - 1, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit"
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return new Date(`${label}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  return label;
}

export function buildAnalyticsQueryString(filters, extra = {}) {
  const params = new URLSearchParams();
  if (filters.preset && filters.preset !== "custom") {
    params.set("preset", filters.preset);
  } else if (filters.dateFrom && filters.dateTo) {
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
  } else if (filters.months) {
    params.set("months", String(filters.months));
  }
  if (filters.granularity) params.set("granularity", filters.granularity);
  if (filters.productIds?.length) params.set("productIds", filters.productIds.join(","));
  if (filters.supplierIds?.length) params.set("supplierIds", filters.supplierIds.join(","));
  if (filters.lineType) params.set("lineType", filters.lineType);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") params.set(k, String(v));
  }
  return params.toString();
}
