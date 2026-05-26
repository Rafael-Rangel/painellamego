import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { api, withAuth } from "../../api";
import "../../charts/chartSetup";
import { buildAnalyticsQueryString, formatQty } from "../../lib/analyticsFormatters";
import { formatCurrency } from "../../lib/formatters";
import ChartCard from "../ui/ChartCard";
import CompactTable from "../ui/CompactTable";
import DataCard from "../ui/DataCard";
import KpiCardCompact from "../ui/KpiCardCompact";
import SingleSelectSearch from "../ui/SingleSelectSearch";
import AnalyticsFilterBar from "./AnalyticsFilterBar";

const CHART_COLORS = ["#4b0c0c", "#cd292d", "#eca02f", "#7a1919", "#d15555", "#3d6b2f"];

export default function SuppliersAnalyticsTab({ token, filters, onChange, onClear, products, suppliers }) {
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
        const res = await api.get(`/manager/analytics/suppliers?${qs}`, withAuth(token));
        if (!cancelled) setList(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Erro ao carregar fornecedores.");
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
        const res = await api.get(`/manager/analytics/suppliers/${selectedId}?${qs}`, withAuth(token));
        if (!cancelled) setDetail(res.data);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId, qs]);

  const chartData = useMemo(
    () => ({
      labels: list.slice(0, 8).map((s) => s.supplierName),
      datasets: [{ data: list.slice(0, 8).map((s) => s.totalSpent), backgroundColor: CHART_COLORS }]
    }),
    [list]
  );

  return (
    <div className="grid">
      <AnalyticsFilterBar filters={filters} onChange={onChange} onClear={onClear} products={products} suppliers={suppliers} />

      {error ? <p className="field-error span-12">{error}</p> : null}

      <section className="span-6">
        <ChartCard title="Fornecedores por gasto" height={300}>
          {chartData.labels.length ? (
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "50%",
                plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } }
              }}
            />
          ) : (
            <p className="empty">Sem dados.</p>
          )}
        </ChartCard>
      </section>

      <section className="span-6 card">
        <div className="field">
          <SingleSelectSearch
            label="Detalhar fornecedor"
            placeholder="Buscar fornecedor..."
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            value={selectedId}
            onChange={setSelectedId}
          />
        </div>
        {detail && !detail.empty ? (
          <div className="kpi-grid-5" style={{ marginTop: "1rem" }}>
            <KpiCardCompact label="Gasto total" value={formatCurrency(detail.totalSpent)} />
            <KpiCardCompact label="Quantidade" value={formatQty(detail.totalQty)} />
            <KpiCardCompact label="Produtos distintos" value={detail.productCount} />
            <KpiCardCompact label="Preço médio ponderado" value={formatCurrency(detail.avgPrice)} />
          </div>
        ) : selectedId ? (
          <p className="empty">Sem compras deste fornecedor no período.</p>
        ) : (
          <p className="field-helper">Selecione um fornecedor para ver o mix de produtos.</p>
        )}
      </section>

      {detail?.products?.length ? (
        <section className="span-12">
          <DataCard title={`Produtos — ${detail.supplierName}`}>
            <CompactTable
              scrollHorizontal
              mobileCompact
              columns={[
                { id: "name", label: "Produto" },
                { id: "qty", label: "Qtd", render: (r) => formatQty(r.totalQty, r.standardUnit) },
                { id: "spent", label: "Gasto", render: (r) => formatCurrency(r.totalSpent) },
                { id: "avg", label: "Médio", render: (r) => formatCurrency(r.avgPrice) },
                { id: "min", label: "Mín", render: (r) => formatCurrency(r.minPrice) },
                { id: "max", label: "Máx", render: (r) => formatCurrency(r.maxPrice) }
              ]}
              rows={detail.products}
              keyField="productId"
              emptyMessage="Sem produtos."
            />
          </DataCard>
        </section>
      ) : null}

      <section className="span-12">
        <DataCard title="Ranking de fornecedores">
          <CompactTable
            scrollHorizontal
            mobileCompact
            columns={[
              { id: "name", label: "Fornecedor", render: (r) => r.supplierName },
              { id: "spent", label: "Gasto", render: (r) => formatCurrency(r.totalSpent) },
              { id: "qty", label: "Qtd", render: (r) => formatQty(r.totalQty) },
              { id: "products", label: "Produtos", render: (r) => r.productCount },
              { id: "avg", label: "Preço médio", render: (r) => formatCurrency(r.avgPrice) },
              {
                id: "action",
                label: "",
                render: (r) => (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(r.supplierId)}>
                    Ver
                  </button>
                )
              }
            ]}
            rows={list}
            keyField="supplierId"
            loading={loading}
            emptyMessage="Nenhum fornecedor no período."
          />
        </DataCard>
      </section>
    </div>
  );
}
