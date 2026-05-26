import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Link } from "react-router-dom";
import { api, withAuth } from "../../api";
import "../../charts/chartSetup";
import { buildAnalyticsQueryString, bucketLabel } from "../../lib/analyticsFormatters";
import { formatCurrency } from "../../lib/formatters";
import ChartCard from "../ui/ChartCard";
import DataCard from "../ui/DataCard";
import KpiCardCompact from "../ui/KpiCardCompact";
import DeltaBadge from "./DeltaBadge";
import AnalyticsFilterBar from "./AnalyticsFilterBar";

const CHART_COLORS = ["#4b0c0c", "#cd292d", "#eca02f", "#7a1919", "#d15555"];

const currencyTooltip = {
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw;
          if (v == null || Number.isNaN(Number(v))) return ctx.label || "";
          return `${ctx.dataset.label ? `${ctx.dataset.label}: ` : ""}${formatCurrency(Number(v))}`;
        }
      }
    }
  }
};

export default function OverviewAnalyticsTab({ token, filters, onChange, onClear, products, suppliers, rankings }) {
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
        const res = await api.get(`/manager/analytics/overview?${qs}`, withAuth(token));
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Erro ao carregar visão geral.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, qs]);

  const o = data || {};
  const gran = filters.granularity || "month";

  const lineSpendData = useMemo(
    () => ({
      labels: (o.spendByBucket || []).map((b) => bucketLabel(b.label, gran)),
      datasets: [
        {
          label: "Gasto",
          data: (o.spendByBucket || []).map((b) => Number(b.amount || 0)),
          borderColor: CHART_COLORS[0],
          backgroundColor: "rgba(75, 12, 12, 0.08)",
          tension: 0.25,
          fill: true
        }
      ]
    }),
    [o.spendByBucket, gran]
  );

  const lineQtyData = useMemo(
    () => ({
      labels: (o.qtyByBucket || []).map((b) => bucketLabel(b.label, gran)),
      datasets: [
        {
          label: "Quantidade comprada",
          data: (o.qtyByBucket || []).map((b) => Number(b.quantity || 0)),
          borderColor: CHART_COLORS[1],
          backgroundColor: "rgba(205, 41, 45, 0.12)",
          tension: 0.25,
          fill: true
        }
      ]
    }),
    [o.qtyByBucket, gran]
  );

  const doughnutSupplierData = useMemo(() => {
    const top = rankings?.topSuppliers?.slice(0, 6) || [];
    return {
      labels: top.map((s) => s.supplierName),
      datasets: [{ data: top.map((s) => s.totalSpent), backgroundColor: CHART_COLORS }]
    };
  }, [rankings]);

  const barCategoryData = useMemo(
    () => ({
      labels: (o.spendByCategory || []).map((c) => c.category),
      datasets: [
        {
          label: "Gasto",
          data: (o.spendByCategory || []).map((c) => c.amount),
          backgroundColor: CHART_COLORS[0],
          borderRadius: 8
        }
      ]
    }),
    [o.spendByCategory]
  );

  const barProductData = useMemo(
    () => ({
      labels: (o.topProductsBySpend || []).map((p) => p.name),
      datasets: [
        {
          label: "Gasto",
          data: (o.topProductsBySpend || []).map((p) => p.amount),
          backgroundColor: CHART_COLORS[0],
          borderRadius: 8
        }
      ]
    }),
    [o.topProductsBySpend]
  );

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: { y: { ticks: { callback: (v) => formatCurrency(v) } } }
  };

  const qtyLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
  };

  const barHOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { ...currencyTooltip.plugins, legend: { display: false } },
    scales: { x: { ticks: { callback: (v) => formatCurrency(v) } } }
  };

  return (
    <div className="grid">
      <AnalyticsFilterBar filters={filters} onChange={onChange} onClear={onClear} products={products} suppliers={suppliers} />
      {error ? <p className="field-error span-12">{error}</p> : null}
      {loading ? <p className="empty span-12">Carregando indicadores...</p> : null}

      <section className="card span-12">
        <div className="kpi-grid-5 kpi-grid-extended">
          <KpiCardCompact label="Total gasto" value={formatCurrency(o.totalSpent || 0)} />
          <KpiCardCompact label="Quantidade comprada (linhas)" value={Number(o.totalQty || 0).toLocaleString("pt-BR")} />
          <KpiCardCompact label="Compras" value={o.purchasesCount || 0} />
          <KpiCardCompact label="Ticket médio" value={formatCurrency(o.avgTicket || 0)} />
          <KpiCardCompact label="Fornecedores" value={o.suppliersCount || 0} />
          <KpiCardCompact
            label="Variação média de preço"
            value={
              <DeltaBadge
                direction={o.priceChangeDirection}
                percent={o.avgPriceChangePercent}
                compact
              />
            }
          />
          <KpiCardCompact
            label="Eficiência"
            value={o.efficiencyScore != null ? Number(o.efficiencyScore).toFixed(1) : "n/d"}
            hint={o.storeName || undefined}
          />
        </div>
        <p className="subtitle" style={{ marginTop: "0.8rem" }}>
          Inteligência de compras com base nas notas registradas.{" "}
          <Link to="/onboarding">Completar onboarding da loja</Link>
        </p>
      </section>

      <section className="span-6">
        <ChartCard title="Gasto no período" height={300}>
          {(o.spendByBucket || []).some((b) => b.amount > 0) ? (
            <Line data={lineSpendData} options={lineOptions} />
          ) : (
            <p className="empty">Sem lançamentos no período.</p>
          )}
        </ChartCard>
      </section>
      <section className="span-6">
        <ChartCard title="Quantidade comprada" subtitle="Soma por intervalo" height={300}>
          {(o.qtyByBucket || []).some((b) => b.quantity > 0) ? (
            <Line data={lineQtyData} options={qtyLineOptions} />
          ) : (
            <p className="empty">Sem quantidades no período.</p>
          )}
        </ChartCard>
      </section>

      <section className="span-6">
        <ChartCard title="Fornecedores" subtitle="Maior volume de compras" height={280}>
          {doughnutSupplierData.labels.length ? (
            <Doughnut
              data={doughnutSupplierData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "52%",
                plugins: { legend: { position: "bottom" } }
              }}
            />
          ) : (
            <p className="empty">Sem fornecedores.</p>
          )}
        </ChartCard>
      </section>
      <section className="span-6">
        <ChartCard title="Top produtos (gasto)" height={280}>
          {(o.topProductsBySpend || []).length ? (
            <Bar data={barProductData} options={barHOptions} />
          ) : (
            <p className="empty">Sem produtos.</p>
          )}
        </ChartCard>
      </section>

      <section className="span-12">
        <ChartCard title="Por categoria" height={260}>
          {(o.spendByCategory || []).length ? <Bar data={barCategoryData} options={barHOptions} /> : <p className="empty">Sem categorias.</p>}
        </ChartCard>
      </section>

      {rankings ? (
        <section className="span-12 analytics-rankings-row">
          <DataCard title="Destaques do período" subtitle="Rankings estratégicos">
            <div className="analytics-rankings-grid">
              <div>
                <h4 className="analytics-rank-title">Maior aumento de preço</h4>
                <ul className="analytics-rank-list">
                  {(rankings.topPriceIncrease || []).slice(0, 5).map((p) => (
                    <li key={p.productId}>
                      {p.name}{" "}
                      <DeltaBadge direction="up" percent={p.periodDeltaPercent} compact />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="analytics-rank-title">Maior volume comprado</h4>
                <ul className="analytics-rank-list">
                  {(rankings.topQty || []).slice(0, 5).map((p) => (
                    <li key={p.productId}>
                      {p.name} — {Number(p.totalQty).toLocaleString("pt-BR")} {p.standardUnit}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="analytics-rank-title">Maior gasto</h4>
                <ul className="analytics-rank-list">
                  {(rankings.topSpend || []).slice(0, 5).map((p) => (
                    <li key={p.productId}>
                      {p.name} — {formatCurrency(p.totalSpent)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DataCard>
        </section>
      ) : null}
    </div>
  );
}
