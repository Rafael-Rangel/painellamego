import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const DEFAULTS = {
  preset: "30d",
  granularity: "month",
  dateFrom: "",
  dateTo: "",
  productIds: [],
  supplierIds: []
};

function parseList(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      preset: searchParams.get("preset") || DEFAULTS.preset,
      granularity: searchParams.get("granularity") || DEFAULTS.granularity,
      dateFrom: searchParams.get("from") || "",
      dateTo: searchParams.get("to") || "",
      months: Number(searchParams.get("months") || 0) || undefined,
      productIds: parseList(searchParams.get("productIds")),
      supplierIds: parseList(searchParams.get("supplierIds")),
      analyticsTab: searchParams.get("analyticsTab") || "geral"
    }),
    [searchParams]
  );

  const setFilters = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const merged = { ...filters, ...patch };
          if (merged.preset && merged.preset !== "custom") {
            next.set("preset", merged.preset);
            next.delete("from");
            next.delete("to");
          } else if (merged.dateFrom && merged.dateTo) {
            next.set("preset", "custom");
            next.set("from", merged.dateFrom);
            next.set("to", merged.dateTo);
          }
          if (merged.granularity) next.set("granularity", merged.granularity);
          if (merged.productIds?.length) next.set("productIds", merged.productIds.join(","));
          else next.delete("productIds");
          if (merged.supplierIds?.length) next.set("supplierIds", merged.supplierIds.join(","));
          else next.delete("supplierIds");
          if (merged.analyticsTab) next.set("analyticsTab", merged.analyticsTab);
          return next;
        },
        { replace: true }
      );
    },
    [filters, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("preset", "30d");
        next.set("granularity", "month");
        next.delete("from");
        next.delete("to");
        next.delete("productIds");
        next.delete("supplierIds");
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  return { filters, setFilters, clearFilters };
}
