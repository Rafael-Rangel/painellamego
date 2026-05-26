import { useEffect, useMemo, useState } from "react";
import { api, withAuth } from "../../api";
import { buildAnalyticsQueryString } from "../../lib/analyticsFormatters";
import { useAnalyticsFilters } from "../../hooks/useAnalyticsFilters";
import FinanceAnalyticsTab from "./FinanceAnalyticsTab";
import OverviewAnalyticsTab from "./OverviewAnalyticsTab";
import ProductsAnalyticsTab from "./ProductsAnalyticsTab";
import SuppliersAnalyticsTab from "./SuppliersAnalyticsTab";

const TABS = [
  { id: "geral", label: "Visão Geral" },
  { id: "produtos", label: "Produtos" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "financeiro", label: "Financeiro" }
];

export default function ManagerAnalyticsDashboard({ token, products, suppliers }) {
  const { filters, setFilters, clearFilters } = useAnalyticsFilters();
  const [rankings, setRankings] = useState(null);
  const activeTab = filters.analyticsTab || "geral";

  const qs = useMemo(() => buildAnalyticsQueryString(filters), [filters]);

  useEffect(() => {
    if (!token || activeTab !== "geral") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/manager/analytics/rankings?${qs}`, withAuth(token));
        if (!cancelled) setRankings(res.data);
      } catch {
        if (!cancelled) setRankings(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, qs, activeTab]);

  const setTab = (analyticsTab) => setFilters({ analyticsTab });

  const common = {
    token,
    filters,
    onChange: setFilters,
    onClear: clearFilters,
    products,
    suppliers
  };

  return (
    <div className="analytics-dashboard">
      <nav className="analytics-subnav" aria-label="Inteligência de compras">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`analytics-subnav-btn ${activeTab === t.id ? "analytics-subnav-btn--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "geral" ? <OverviewAnalyticsTab {...common} rankings={rankings} /> : null}
      {activeTab === "produtos" ? <ProductsAnalyticsTab {...common} /> : null}
      {activeTab === "fornecedores" ? <SuppliersAnalyticsTab {...common} /> : null}
      {activeTab === "financeiro" ? <FinanceAnalyticsTab {...common} /> : null}
    </div>
  );
}
