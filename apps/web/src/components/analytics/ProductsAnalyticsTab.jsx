import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { api, withAuth } from "../../api";
import "../../charts/chartSetup";
import { buildAnalyticsQueryString, formatQty } from "../../lib/analyticsFormatters";
import { formatCurrency } from "../../lib/formatters";
import ChartCard from "../ui/ChartCard";
import CompactTable from "../ui/CompactTable";
import DataCard from "../ui/DataCard";
import KpiCardCompact from "../ui/KpiCardCompact";
import SingleSelectSearch from "../ui/SingleSelectSearch";
import DeltaBadge from "./DeltaBadge";
import AnalyticsFilterBar from "./AnalyticsFilterBar";
import PriceEvolutionChart from "./PriceEvolutionChart";

export default function ProductsAnalyticsTab({ token, filters, onChange, onClear, products, suppliers }) {
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState("");
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
        const res = await api.get(`/manager/analytics/products?${qs}`, withAuth(token));
        if (!cancelled) setList(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Erro ao carregar produtos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, qs]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/manager/analytics/products/${selectedId}?${qs}`, withAuth(token));
        if (!cancelled) setDetail(res.data);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId, qs]);

  const qtyBarData = useMemo(() => {
    if (!detail?.qtyByBucket?.length) return null;
    return {
      labels: detail.qtyByBucket.map((b) => b.label),
      datasets: [
        {
          label: "Qtd",
          data: detail.qtyByBucket.map((b) => b.quantity),
          backgroundColor: "#4b0c0c",
          borderRadius: 8
        }
      ]
    };
  }, [detail]);

  return (
    <div className="grid">
      <AnalyticsFilterBar filters={filters} onChange={onChange} onClear={onClear} products={products} suppliers={suppliers} />
      {error ? <p className="field-error span-12">{error}</p> : null}

      <section className="card span-12">
        <div className="field" style={{ maxWidth: 420 }}>
          <SingleSelectSearch
            label="Detalhar produto"
            placeholder="Buscar produto..."
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            value={selectedId}
            onChange={setSelectedId}
          />
        </div>
      </section>

      {detail && !detail.empty ? (
        <>
          <section className="card span-12">
            <h3 className="analytics-section-title">{detail.name}</h3>
            <div className="kpi-grid-5 kpi-grid-extended">
              <KpiCardCompact label="Quantidade comprada" value={formatQty(detail.totalQty, detail.standardUnit)} />
              <KpiCardCompact label="Total gasto" value={formatCurrency(detail.totalSpent)} />
              <KpiCardCompact label="Preço médio" value={formatCurrency(detail.avgPrice)} />
              <KpiCardCompact label="Menor preço" value={formatCurrency(detail.minPrice)} />
              <KpiCardCompact label="Maior preço" value={formatCurrency(detail.maxPrice)} />
              <KpiCardCompact
                label="Última vs anterior"
                value={
                  <DeltaBadge
                    direction={detail.priceDirection}
                    percent={detail.deltaPercent}
                    amount={detail.deltaAmount}
                  />
                }
              />
            </div>
          </section>
          <section className="span-8">
            <PriceEvolutionChart
              pricePoints={detail.pricePoints}
              spendByBucket={detail.spendByBucket}
              granularity={filters.granularity}
              avgPrice={detail.avgPrice}
            />
          </section>
          <section className="span-4">
            <ChartCard title="Quantidade por intervalo" height={280}>
              {qtyBarData ? (
                <Bar data={qtyBarData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              ) : (
                <p className="empty">Sem dados.</p>
              )}
            </ChartCard>
          </section>
        </>
      ) : selectedId ? (
        <p className="empty span-12">Sem compras deste produto no período.</p>
      ) : null}

      <section className="span-12">
        <DataCard title="Todos os produtos no período" subtitle="Quantidade comprada e variação de preço">
          <p className="ledger-table-scroll-hint" aria-hidden="true">
            Deslize a tabela para ver todas as colunas
          </p>
          <CompactTable
            scrollHorizontal
            mobileCompact
            columns={[
              { id: "name", label: "Produto", clamp: false },
              {
                id: "qty",
                label: "Qtd comprada",
                render: (r) => formatQty(r.totalQty, r.standardUnit)
              },
              { id: "spent", label: "Gasto", render: (r) => formatCurrency(r.totalSpent) },
              { id: "avg", label: "Médio", render: (r) => formatCurrency(r.avgPrice) },
              { id: "min", label: "Mín", render: (r) => formatCurrency(r.minPrice) },
              { id: "max", label: "Máx", render: (r) => formatCurrency(r.maxPrice) },
              {
                id: "delta",
                label: "Oscilação",
                render: (r) => <DeltaBadge direction={r.priceDirection} percent={r.deltaPercent} compact />
              },
              {
                id: "period",
                label: "Δ período",
                render: (r) => <DeltaBadge direction={r.periodPriceDirection} percent={r.periodDeltaPercent} compact />
              },
              {
                id: "action",
                label: "",
                render: (r) => (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(r.productId)}>
                    Ver
                  </button>
                )
              }
            ]}
            rows={list}
            keyField="productId"
            loading={loading}
            emptyMessage="Nenhum produto no período."
          />
        </DataCard>
      </section>
    </div>
  );
}
