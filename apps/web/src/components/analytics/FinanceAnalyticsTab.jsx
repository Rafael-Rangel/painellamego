import { useEffect, useMemo, useState } from "react";
import { api, withAuth } from "../../api";
import { buildAnalyticsQueryString, formatPercent, formatQty } from "../../lib/analyticsFormatters";
import { formatCurrency } from "../../lib/formatters";
import CompactTable from "../ui/CompactTable";
import DataCard from "../ui/DataCard";
import KpiCardCompact from "../ui/KpiCardCompact";
import DeltaBadge from "./DeltaBadge";
import AnalyticsFilterBar from "./AnalyticsFilterBar";

export default function FinanceAnalyticsTab({ token, filters, onChange, onClear, products, suppliers }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const qs = useMemo(() => buildAnalyticsQueryString(filters), [filters]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/manager/analytics/finance?${qs}`, withAuth(token));
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Erro ao carregar financeiro.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, qs]);

  const d = data || {};

  return (
    <div className="grid">
      <AnalyticsFilterBar filters={filters} onChange={onChange} onClear={onClear} products={products} suppliers={suppliers} />
      {error ? <p className="field-error span-12">{error}</p> : null}

      <section className="card span-12">
        <div className="kpi-grid-5 kpi-grid-extended">
          <KpiCardCompact label="Impacto de aumentos (estimado)" value={formatCurrency(d.totalInflationImpact || 0)} />
          <KpiCardCompact
            label="Produtos com preço de venda"
            value={`${d.productsWithSalePrice || 0} / ${d.productsTotal || 0}`}
            hint={d.salePriceCoveragePercent != null ? `${formatPercent(d.salePriceCoveragePercent, 0)} cadastrados` : undefined}
          />
          <KpiCardCompact label="Margem negativa" value={d.negativeMarginCount || 0} hint="Com preço de venda informado" />
        </div>
        {(d.salePriceCoveragePercent || 0) < 50 ? (
          <p className="field-helper" style={{ marginTop: "0.75rem" }}>
            Cadastre o preço de venda na aba Catálogo para ver margem estimada por produto.
          </p>
        ) : null}
      </section>

      {d.criticalProducts?.length ? (
        <section className="span-12">
          <DataCard title="Alertas de margem" subtitle="Produtos com margem estimada negativa">
            <ul className="analytics-alert-list">
              {d.criticalProducts.map((p) => (
                <li key={p.productId}>
                  <strong>{p.name}</strong> — margem {formatPercent(p.marginPercent)} (custo médio{" "}
                  {formatCurrency(p.avgPurchasePrice)} vs venda {formatCurrency(p.salePrice)})
                </li>
              ))}
            </ul>
          </DataCard>
        </section>
      ) : null}

      <section className="span-12">
        <DataCard title="Impacto financeiro por produto" subtitle="Variação de preço × volume comprado no período">
          <p className="ledger-table-scroll-hint" aria-hidden="true">
            Deslize a tabela para ver todas as colunas
          </p>
          <CompactTable
            scrollHorizontal
            mobileCompact
            columns={[
              { id: "name", label: "Produto", clamp: false },
              { id: "qty", label: "Qtd", render: (r) => formatQty(r.totalQty, r.standardUnit) },
              { id: "spent", label: "Gasto", render: (r) => formatCurrency(r.totalSpent) },
              { id: "avg", label: "Custo médio", render: (r) => formatCurrency(r.avgPurchasePrice) },
              {
                id: "sale",
                label: "Preço venda",
                render: (r) => (r.salePrice != null ? formatCurrency(r.salePrice) : "—")
              },
              {
                id: "margin",
                label: "Margem est.",
                render: (r) => (r.marginPercent != null ? formatPercent(r.marginPercent) : "—")
              },
              {
                id: "impact",
                label: "Impacto Δ preço",
                render: (r) => (
                  <span className={r.priceImpact > 0 ? "delta-badge delta-badge--up" : r.priceImpact < 0 ? "delta-badge delta-badge--down" : ""}>
                    {formatCurrency(r.priceImpact)}
                  </span>
                )
              },
              {
                id: "osc",
                label: "Oscilação",
                render: (r) => <DeltaBadge direction={r.priceDirection} percent={r.deltaPercent} compact />
              }
            ]}
            rows={d.items || []}
            keyField="productId"
            loading={loading}
            emptyMessage="Sem dados no período."
          />
        </DataCard>
      </section>
    </div>
  );
}
