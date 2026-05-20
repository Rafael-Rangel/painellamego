import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import AppShell from "../components/AppShell";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { api, withAuth } from "../api";
import { useAuth } from "../auth/AuthProvider";
import "../charts/chartSetup";
import ChartCard from "../components/ui/ChartCard";
import CompactTable from "../components/ui/CompactTable";
import { summarizePurchaseItems } from "../components/ui/tableCellUtils";
import DataCard from "../components/ui/DataCard";
import KpiCardCompact from "../components/ui/KpiCardCompact";
import MultiSelectSearch from "../components/ui/MultiSelectSearch";
import TableToolbar from "../components/ui/TableToolbar";
import SupplierCrudPanel from "../components/catalog/SupplierCrudPanel";
import { formatCurrency, formatDate } from "../lib/formatters";

const CHART_COLORS = ["#4b0c0c", "#cd292d", "#eca02f", "#7a1919", "#d15555", "#3d6b2f", "#2c5282", "#6b4c9a"];

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

function monthLabel(ym) {
  if (!ym || typeof ym !== "string") return "";
  const [y, mo] = ym.split("-");
  const m = parseInt(mo, 10);
  return new Date(Number(y, 10), m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default function ManagerPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [historyProductIds, setHistoryProductIds] = useState([]);
  const [historySupplierIds, setHistorySupplierIds] = useState([]);
  const [dashboardMonths, setDashboardMonths] = useState(6);
  const [dashboardProductIds, setDashboardProductIds] = useState([]);
  const [dashboardSupplierIds, setDashboardSupplierIds] = useState([]);
  const [toast, setToast] = useState("");

  const emptyOverview = useMemo(
    () => ({
      totalSpent: 0,
      purchasesCount: 0,
      suppliersCount: 0,
      itemsCount: 0,
      avgTicket: 0,
      spendByMonth: [],
      spendBySupplier: [],
      spendByCategory: [],
      spendByWeek: [],
      spendByProduct: [],
      efficiencyScore: null,
      storeName: null,
      storeCode: null
    }),
    []
  );

  const managerDashboardQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("months", String(dashboardMonths || 6));
    if (dashboardProductIds.length) params.set("productIds", dashboardProductIds.join(","));
    if (dashboardSupplierIds.length) params.set("supplierIds", dashboardSupplierIds.join(","));
    return params.toString();
  }, [dashboardMonths, dashboardProductIds, dashboardSupplierIds]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, historyRes, productsRes, suppliersRes] = await Promise.all([
        api.get(`/manager/overview?${managerDashboardQuery}`, withAuth(token)),
        api.get("/purchases/me", withAuth(token)),
        api.get("/catalog/products", withAuth(token)),
        api.get("/catalog/suppliers", withAuth(token))
      ]);
      setOverview(overviewRes.data || emptyOverview);
      setHistory(historyRes.data || []);
      setProducts(productsRes.data?.length ? productsRes.data : []);
      setSuppliers(suppliersRes.data?.length ? suppliersRes.data : []);
    } catch {
      setError("Nao foi possivel carregar os dados. Verifique sua conexao ou tente novamente.");
      setProducts([]);
      setSuppliers([]);
      setHistory([]);
      setOverview(emptyOverview);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadAll();
  }, [token, managerDashboardQuery]);

  useEffect(() => {
    if (location.pathname !== "/manager") return;
    const qTab = new URLSearchParams(location.search).get("tab");
    if (qTab === "history" || qTab === "catalog") return setTab(qTab);
    setTab("overview");
  }, [location.pathname, location.search]);

  const links = useMemo(() => buildManagerSidebarLinks(navigate, setTab), [navigate]);

  const o = overview || emptyOverview;

  const lineSpendData = useMemo(
    () => ({
      labels: (o.spendByMonth || []).map((m) => monthLabel(m.month)),
      datasets: [
        {
          label: "Gasto no mês",
          data: (o.spendByMonth || []).map((m) => Number(m.amount || 0)),
          borderColor: "#C0392B",
          backgroundColor: "rgb(192 57 43 / 14%)",
          fill: true,
          tension: 0.35
        }
      ]
    }),
    [o.spendByMonth]
  );

  const doughnutSupplierData = useMemo(() => {
    const list = o.spendBySupplier || [];
    return {
      labels: list.map((x) => x.name),
      datasets: [
        {
          data: list.map((x) => Number(x.amount || 0)),
          backgroundColor: CHART_COLORS,
          borderWidth: 1,
          borderColor: "#fff"
        }
      ]
    };
  }, [o.spendBySupplier]);

  const barWeekData = useMemo(
    () => ({
      labels: (o.spendByWeek || []).map((w) => `Semana ${w.week}`),
      datasets: [
        {
          label: "Total no período (por semana do mês)",
          data: (o.spendByWeek || []).map((w) => Number(w.amount || 0)),
          backgroundColor: "#C0392B",
          borderRadius: 8
        }
      ]
    }),
    [o.spendByWeek]
  );

  const barCategoryData = useMemo(
    () => ({
      labels: (o.spendByCategory || []).map((c) => c.category),
      datasets: [
        {
          label: "Gasto",
          data: (o.spendByCategory || []).map((c) => Number(c.amount || 0)),
          backgroundColor: "#eca02f",
          borderRadius: 8
        }
      ]
    }),
    [o.spendByCategory]
  );

  const barProductData = useMemo(
    () => ({
      labels: (o.spendByProduct || []).map((p) => p.name),
      datasets: [
        {
          label: "Gasto",
          data: (o.spendByProduct || []).map((p) => Number(p.amount || 0)),
          backgroundColor: "#4b0c0c",
          borderRadius: 8
        }
      ]
    }),
    [o.spendByProduct]
  );

  const filteredHistory = history.filter((purchase) => {
    const items = purchase.purchase_items || [];
    const productOk = !historyProductIds.length || items.some((it) => historyProductIds.includes(it.product_id));
    const supplierOk = !historySupplierIds.length || items.some((it) => historySupplierIds.includes(it.supplier_id));
    const dateOk =
      (!dateFrom || new Date(purchase.created_at) >= new Date(dateFrom)) &&
      (!dateTo || new Date(purchase.created_at) <= new Date(dateTo));
    return productOk && supplierOk && dateOk;
  });

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "52%",
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, padding: 10 } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const val = Number(ctx.raw || 0);
            const pct = total ? ((val / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
          }
        }
      }
    }
  };

  const barWeekOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...currencyTooltip.plugins,
      legend: { display: false }
    },
    scales: {
      y: {
        ticks: {
          callback: (v) => formatCurrency(v)
        }
      }
    }
  };

  const barCategoryHOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...currencyTooltip.plugins,
      legend: { display: false }
    },
    scales: {
      x: {
        ticks: { callback: (value) => formatCurrency(value) }
      }
    }
  };

  const hasMonthData = (o.spendByMonth || []).some((m) => Number(m.amount) > 0);
  const hasSupplierData = (o.spendBySupplier || []).some((s) => Number(s.amount) > 0);
  const hasCategoryData = (o.spendByCategory || []).length > 0;
  const hasProductData = (o.spendByProduct || []).length > 0;

  const storeBadge =
    o.storeCode != null && String(o.storeCode).length
      ? `Loja ${o.storeCode}${o.storeName ? ` · ${o.storeName}` : ""}`
      : null;

  const refreshCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const suppliersRes = await api.get("/catalog/suppliers", withAuth(token));
      setSuppliers(suppliersRes.data?.length ? suppliersRes.data : []);
    } catch {
      setSuppliers([]);
    }
  }, [token]);

  return (
    <AppShell
      title="Painel do Gerente"
      subtitle="Voce ve somente sua padaria e seus lancamentos"
      links={links}
      activeLinkKey={tab}
      storeBadge={storeBadge}
    >
      {toast ? <p className="toast-banner">{toast}</p> : null}
      {loading ? <p className="empty">Carregando dados...</p> : null}
      {error ? <p className="field-error">{error}</p> : null}

      {tab === "overview" ? (
        <div className="grid">
          <section className="card span-12">
            <TableToolbar>
              <div className="field span-3">
                <label>Período</label>
                <select value={dashboardMonths} onChange={(e) => setDashboardMonths(Number(e.target.value))}>
                  <option value={3}>3 meses</option>
                  <option value={6}>6 meses</option>
                  <option value={12}>12 meses</option>
                </select>
              </div>
              <div className="span-4">
                <MultiSelectSearch
                  label="Produtos"
                  placeholder="Digite e selecione..."
                  options={products.map((p) => ({ value: p.id, label: p.name }))}
                  value={dashboardProductIds}
                  onChange={setDashboardProductIds}
                  maxChips={2}
                />
              </div>
              <div className="span-4">
                <MultiSelectSearch
                  label="Fornecedores"
                  placeholder="Digite e selecione..."
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={dashboardSupplierIds}
                  onChange={setDashboardSupplierIds}
                  maxChips={2}
                />
              </div>
              <div className="field span-1">
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setDashboardMonths(6);
                    setDashboardProductIds([]);
                    setDashboardSupplierIds([]);
                  }}
                >
                  Limpar
                </button>
              </div>
            </TableToolbar>
            <div className="kpi-grid-5 kpi-grid-extended">
              <KpiCardCompact label="Total gasto (todas as compras)" value={formatCurrency(o.totalSpent || 0)} />
              <KpiCardCompact label="Compras registradas" value={o.purchasesCount || 0} />
              <KpiCardCompact label="Linhas de item" value={o.itemsCount || 0} />
              <KpiCardCompact label="Ticket médio por compra" value={formatCurrency(o.avgTicket || 0)} />
              <KpiCardCompact label="Fornecedores utilizados" value={o.suppliersCount || 0} />
              <KpiCardCompact
                label="Score de eficiência"
                value={o.efficiencyScore != null ? Number(o.efficiencyScore).toFixed(1) : "—"}
                hint={o.storeName || "Sua loja"}
              />
              <KpiCardCompact
                label="Loja"
                value={o.storeCode != null ? o.storeCode : user?.storeId ? "—" : "nao definida"}
                hint={o.storeName || undefined}
              />
            </div>
            <p className="subtitle" style={{ marginTop: "0.8rem" }}>
              Indicadores calculados a partir dos itens de compra no banco.{" "}
              <Link to="/onboarding">Completar onboarding da loja</Link>
            </p>
          </section>

          <section className="span-6">
            <ChartCard title="Gasto por mês" subtitle={`Últimos ${dashboardMonths} meses (soma das linhas de compra)`} height={300}>
              {hasMonthData ? (
                <Line data={lineSpendData} options={lineOptions} />
              ) : (
                <p className="empty">Sem lançamentos com data nos últimos meses.</p>
              )}
            </ChartCard>
          </section>

          <section className="span-6">
            <ChartCard title="Gasto por fornecedor" subtitle="Distribuição no período acumulado" height={300}>
              {hasSupplierData ? (
                <Doughnut data={doughnutSupplierData} options={doughnutOptions} />
              ) : (
                <p className="empty">Sem dados de fornecedor.</p>
              )}
            </ChartCard>
          </section>

          <section className="span-4">
            <ChartCard title="Por semana do mês" subtitle="Soma histórica por faixa (1ª–5ª semana)" height={280}>
              <Bar data={barWeekData} options={barWeekOptions} />
            </ChartCard>
          </section>

          <section className="span-4">
            <ChartCard title="Por categoria" subtitle="Soma por categoria de produto" height={280}>
              {hasCategoryData ? <Bar data={barCategoryData} options={barCategoryHOptions} /> : <p className="empty">Sem categorias.</p>}
            </ChartCard>
          </section>

          <section className="span-4">
            <ChartCard title="Top produtos" subtitle="Maior volume de gasto" height={280}>
              {hasProductData ? <Bar data={barProductData} options={barCategoryHOptions} /> : <p className="empty">Sem produtos.</p>}
            </ChartCard>
          </section>

          <section className="span-12">
            <DataCard title="Compras recentes" subtitle="Últimos lançamentos da unidade (dados reais)">
              <CompactTable
                columns={[
                  { id: "created_at", label: "Data", render: (p) => formatDate(p.created_at) },
                  { id: "supplier", label: "Fornecedor", render: (p) => p.purchase_items?.[0]?.suppliers?.name || "-" },
                  {
                    id: "total",
                    label: "Total",
                    render: (p) =>
                      formatCurrency(
                        (p.purchase_items || []).reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0)
                      )
                  },
                  { id: "items", label: "Itens", render: (p) => p.purchase_items?.length || 0 },
                  { id: "note", label: "Status nota", render: (p) => (p.fiscal_receipts?.length ? "Anexada" : "Pendente") }
                ]}
                rows={filteredHistory.slice(0, 8)}
                keyField="id"
                loading={loading}
              />
            </DataCard>
          </section>
        </div>
      ) : null}

      {tab === "history" ? (
        <DataCard title="Histórico de compras" subtitle="Filtros avançados por período, produto e fornecedor">
          <TableToolbar>
            <div className="field span-3">
              <label>Data inicial</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="field span-3">
              <label>Data final</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="field span-3">
              <label>Atalho de período</label>
              <select
                value=""
                onChange={(e) => {
                  const days = Number(e.target.value || 0);
                  if (!days) return;
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - days);
                  setDateFrom(start.toISOString().slice(0, 10));
                  setDateTo(end.toISOString().slice(0, 10));
                }}
              >
                <option value="">Selecionar…</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
                <option value={180}>Últimos 6 meses</option>
                <option value={365}>Últimos 12 meses</option>
              </select>
            </div>
            <div className="span-6">
              <MultiSelectSearch
                label="Produtos"
                placeholder="Digite para filtrar produtos..."
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                value={historyProductIds}
                onChange={setHistoryProductIds}
                maxChips={3}
              />
            </div>
            <div className="span-6">
              <MultiSelectSearch
                label="Fornecedores"
                placeholder="Digite para filtrar fornecedores..."
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                value={historySupplierIds}
                onChange={setHistorySupplierIds}
                maxChips={3}
              />
            </div>
            <div className="field span-12">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setHistoryProductIds([]);
                  setHistorySupplierIds([]);
                }}
              >
                Limpar filtros
              </button>
            </div>
          </TableToolbar>
          <CompactTable
            columns={[
              { id: "created_at", label: "Data", render: (p) => new Date(p.created_at).toLocaleDateString("pt-BR") },
              { id: "invoice_number", label: "NF" },
              {
                id: "items",
                label: "Itens",
                render: (p) => summarizePurchaseItems(p.purchase_items) || "—"
              },
              { id: "fiscal_receipts", label: "Nota fiscal", render: (p) => (p.fiscal_receipts?.length ? "Anexada" : "Nao anexada") }
            ]}
            rows={filteredHistory.slice(0, 50)}
            keyField="id"
            loading={loading}
            emptyMessage="Nenhuma compra encontrada."
          />
        </DataCard>
      ) : null}

      {tab === "catalog" ? (
        <div className="grid catalog-page-grid">
          <section className="span-12">
            <DataCard title="Produtos" subtitle="Catálogo da rede (consulta). Para criar produto novo, use o registo de compra.">
              <CompactTable
                columns={[
                  { id: "name", label: "Nome" },
                  { id: "category", label: "Categoria" },
                  { id: "type", label: "Tipo", render: (p) => p.type || "—" },
                  { id: "standard_unit", label: "Unidade" }
                ]}
                rows={products}
                keyField="id"
                loading={loading}
                emptyMessage="Nenhum produto no catálogo."
              />
            </DataCard>
          </section>
          <section className="span-12">
            <DataCard title="Fornecedores" subtitle="Fornecedores da sua loja — adicione, edite ou remova.">
              <SupplierCrudPanel
                token={token}
                suppliers={suppliers}
                loading={loading}
                onRefresh={refreshCatalog}
                onToast={(msg) => {
                  setToast(msg);
                  setTimeout(() => setToast(""), 4000);
                }}
              />
            </DataCard>
          </section>
        </div>
      ) : null}

    </AppShell>
  );
}
