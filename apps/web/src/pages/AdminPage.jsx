import { useEffect, useMemo, useState } from "react";
import { FaBalanceScale, FaChartBar, FaChartLine, FaCog, FaLightbulb, FaStore, FaTrash } from "react-icons/fa";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import AppShell from "../components/AppShell";
import { api, withAuth } from "../api";
import "../charts/chartSetup";
import { useAuth } from "../auth/AuthProvider";
import BadgeValue from "../components/ui/BadgeValue";
import ChartCard from "../components/ui/ChartCard";
import CompactTable from "../components/ui/CompactTable";
import DataCard from "../components/ui/DataCard";
import KpiCardCompact from "../components/ui/KpiCardCompact";
import MultiSelectSearch from "../components/ui/MultiSelectSearch";
import SingleSelectInput from "../components/ui/SingleSelectInput";
import TableToolbar from "../components/ui/TableToolbar";
import { formatCurrency } from "../lib/formatters";
import { mockProducts, mockStores } from "../mocks/mockData";
import RankingComparisonTab from "../components/admin/RankingComparisonTab";

/** Limite de linhas na tabela do Mapa de oportunidades (sem controle na UI). */
const OPPORTUNITIES_TABLE_MAX = 40;

function deriveOpportunitiesFromComparison(rows = []) {
  return (rows || [])
    .map((row) => {
      const avg = Number(row.avg_price || 0);
      const minNet = Number(row.network_min_price || 0);
      const aboveBestPercent = minNet > 0 ? ((avg - minNet) / minNet) * 100 : 0;
      return {
        store_id: row.store_id,
        store_name: row.store_name,
        product_id: row.product_id,
        product_name: row.product_name,
        store_avg_price: avg,
        network_min_price: minNet,
        best_store_name: row.best_store_name || "-",
        best_store_id: row.best_store_id || null,
        best_store_price: Number(row.best_store_price || minNet || 0),
        above_best_percent: Number(aboveBestPercent.toFixed(2))
      };
    })
    .filter((r) => Number.isFinite(r.above_best_percent) && r.above_best_percent > 0.5)
    .sort((a, b) => b.above_best_percent - a.above_best_percent);
}

export default function AdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [stores, setStores] = useState([]);
  const [managers, setManagers] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [products, setProducts] = useState([]);
  const [productComparisonRows, setProductComparisonRows] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [periodData, setPeriodData] = useState([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [toast, setToast] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [supplierRowsLimit, setSupplierRowsLimit] = useState(10);
  const [supplierFilter, setSupplierFilter] = useState([]);
  const [activeStoreId, setActiveStoreId] = useState([]);
  const [activeProductId, setActiveProductId] = useState([]);
  const [monthsFilter, setMonthsFilter] = useState(6);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    type: "insumo",
    standardUnit: "un"
  });

  const dashboardFilterQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("months", String(monthsFilter || 6));
    if (activeStoreId?.length) params.set("storeIds", activeStoreId.join(","));
    if (activeProductId?.length) params.set("productIds", activeProductId.join(","));
    if (supplierFilter?.length) params.set("suppliers", supplierFilter.join(","));
    return params.toString();
  }, [monthsFilter, activeStoreId, activeProductId, supplierFilter]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [s, r, o, p, m, period, comparison, summary, catalogProductsRes, categoriesRes] = await Promise.all([
        api.get("/catalog/stores", withAuth(token)),
        api.get("/dashboards/stores", withAuth(token)),
        api.get("/admin/comparisons/opportunities", withAuth(token)),
        api.get("/dashboards/products", withAuth(token)),
        api.get("/auth/admin/managers", withAuth(token)),
        api.get(`/dashboards/period?months=${monthsFilter}`, withAuth(token)),
        api.get("/admin/products/comparison", withAuth(token)),
        api.get(`/admin/dashboard/summary?${dashboardFilterQuery}`, withAuth(token)),
        api.get("/catalog/products", withAuth(token)),
        api.get("/catalog/categories", withAuth(token))
      ]);
      setStores(s.data || []);
      setRanking(r.data || []);
      setProducts(p.data || []);
      setManagers(m.data || []);
      setPeriodData(period.data || []);
      const comparisonRows = comparison.data || [];
      setProductComparisonRows(comparisonRows);
      setCatalogProducts(catalogProductsRes.data || []);
      setCategories(categoriesRes.data || []);
      const opportunitiesRows = (o.data || []).length ? o.data : deriveOpportunitiesFromComparison(comparisonRows);
      setOpportunities(opportunitiesRows);
      setDashboardSummary(summary.data || null);
    } catch {
      setError("Nao foi possivel carregar todos os dados. Exibindo estado de referencia.");
      setStores(mockStores);
      setProducts(mockProducts);
      setRanking([]);
      setManagers([]);
      setPeriodData([]);
      const fallbackFromMock = mockProducts.map((p, idx) => ({
        store_id: `mock-store-${(idx % 3) + 1}`,
        store_name: mockStores[idx % mockStores.length]?.name || "Loja",
        product_id: p.id,
        product_name: p.name,
        store_avg_price: 7 + idx,
        network_min_price: 5 + idx * 0.6,
        best_store_name: mockStores[(idx + 1) % mockStores.length]?.name || "Loja",
        best_store_id: null,
        best_store_price: 5 + idx * 0.6,
        above_best_percent: Number((((2 + idx * 0.4) / (5 + idx * 0.6)) * 100).toFixed(2))
      }));
      setProductComparisonRows([]);
      setCatalogProducts(mockProducts.map((p) => ({ ...p, standard_unit: p.standard_unit || "un" })));
      setCategories([]);
      setOpportunities(fallbackFromMock);
      setDashboardSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAll();
  }, [token, monthsFilter, dashboardFilterQuery]);

  async function inviteManager(e) {
    e.preventDefault();
    await api.post(
      "/auth/invite-manager",
      { managerName: inviteName, email: inviteEmail, storeIds: selectedStoreIds },
      withAuth(token)
    );
    setToast("Convite enviado com sucesso.");
    setInviteName("");
    setInviteEmail("");
    setSelectedStoreIds([]);
    setShowInviteModal(false);
    await loadAll();
    setTimeout(() => setToast(""), 2500);
  }

  async function resendInvite(managerId) {
    await api.post(`/auth/admin/managers/${managerId}/resend-invite`, {}, withAuth(token));
    setToast("Convite reenviado.");
    setTimeout(() => setToast(""), 2500);
  }

  function toggleStore(storeId) {
    setSelectedStoreIds((prev) => (prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]));
  }

  const links = [
    { key: "dashboard", label: "Dashboard da Rede", icon: <FaChartBar />, onClick: () => setTab("dashboard") },
    { key: "stores", label: "Lojas & Gerentes", icon: <FaStore />, onClick: () => setTab("stores") },
    { key: "opportunities", label: "Oportunidades", icon: <FaLightbulb />, onClick: () => setTab("opportunities") },
    { key: "products", label: "Análise", icon: <FaChartLine />, onClick: () => setTab("products") },
    { key: "ranking", label: "Comparação", icon: <FaBalanceScale />, onClick: () => setTab("ranking") },
    { key: "products-admin", label: "Produtos (Admin)", icon: <FaCog />, onClick: () => setTab("products-admin") },
    { key: "settings", label: "Configuracoes", icon: <FaCog />, onClick: () => setTab("dashboard") }
  ];

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm({ name: "", category: "", type: "insumo", standardUnit: "un" });
  }

  async function saveProduct(e) {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.category.trim()) return;
    if (editingProductId) {
      await api.put(`/catalog/products/${editingProductId}`, productForm, withAuth(token));
      setToast("Produto atualizado.");
    } else {
      await api.post("/catalog/products", productForm, withAuth(token));
      setToast("Produto criado.");
    }
    resetProductForm();
    await loadAll();
    setTimeout(() => setToast(""), 2200);
  }

  async function removeProduct(id) {
    await api.delete(`/catalog/products/${id}`, withAuth(token));
    setToast("Produto removido.");
    if (editingProductId === id) resetProductForm();
    await loadAll();
    setTimeout(() => setToast(""), 2200);
  }

  const kpis = dashboardSummary?.kpis || {
    totalSpent: 0,
    purchasesCount: 0,
    storesActive: 0,
    avgTicket: 0,
    suppliersActive: 0,
    productsAnalyzed: 0,
    totalQty: 0
  };
  const summarySeries = dashboardSummary?.series || { monthLabels: [], storesSeries: [], suppliersTop: [] };
  const dashboardOpportunitiesTop = dashboardSummary?.opportunitiesTop || [];

  const activeStoreName =
    activeStoreId?.length === 1 ? stores.find((store) => store.id === activeStoreId[0])?.name : undefined;
  const selectedProductFilter =
    selectedProduct || (activeProductId?.length === 1 ? activeProductId[0] : "");

  const filteredProductRows = productComparisonRows
    .filter((row) => (!selectedProductFilter ? true : row.product_id === selectedProductFilter))
    .filter((row) => (!activeStoreName ? true : row.store_name === activeStoreName))
    .slice(0, 40);
  const filteredOpportunities = opportunities
    .filter((row) => (!activeStoreName ? true : row.store_name === activeStoreName))
    .filter((row) => (!selectedProductFilter ? true : row.product_id === selectedProductFilter))
    .slice(0, OPPORTUNITIES_TABLE_MAX);
  const topDashboardOpportunities = (
    activeProductId?.length ? (dashboardOpportunitiesTop.length ? dashboardOpportunitiesTop : filteredOpportunities) : filteredOpportunities
  )
    .slice(0, 5);
  const potentialSavings = filteredOpportunities.reduce(
    (sum, row) => sum + Math.max(0, Number(row.store_avg_price) - Number(row.network_min_price)) * 30,
    0
  );
  const supplierComparisonRows = [...periodData]
    .sort((a, b) => Number(b.total_spent) - Number(a.total_spent))
    .filter((row) => (!activeStoreName ? true : row.store_name === activeStoreName))
    .filter((row) =>
      !supplierFilter?.length
        ? true
        : supplierFilter.some((s) => String(row.supplier_name || "").toLowerCase().includes(String(s).toLowerCase()))
    )
    .slice(0, supplierRowsLimit);

  const categoryOptions = useMemo(() => {
    const fromTable = (categories || []).map((c) => c.name).filter(Boolean);
    const fromProducts = (catalogProducts || []).map((p) => p.category).filter(Boolean);
    return [...new Set([...fromTable, ...fromProducts])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, catalogProducts]);

  const unitOptions = useMemo(() => {
    const fromProducts = (catalogProducts || []).map((p) => p.standard_unit).filter(Boolean);
    const defaults = ["un", "kg", "g", "L", "ml", "cx", "pct", "fardo"];
    return [...new Set([...defaults, ...fromProducts])];
  }, [catalogProducts]);

  const supplierComparisonTotals = useMemo(() => {
    const total = supplierComparisonRows.reduce((sum, r) => sum + Number(r.total_spent || 0), 0);
    const byStore = new Map();
    for (const r of supplierComparisonRows) {
      const key = r.store_name || "Loja";
      byStore.set(key, (byStore.get(key) || 0) + Number(r.total_spent || 0));
    }
    return { total, byStore };
  }, [supplierComparisonRows]);

  const monthlyLabels = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return d.toLocaleDateString("pt-BR", { month: "short" });
    });
  }, []);

  const spendingLineData = useMemo(() => {
    const labels = summarySeries.monthLabels.map((ym) => {
      const [y, m] = String(ym).split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleDateString("pt-BR", { month: "short" });
    });
    const colors = ["#4b0c0c", "#cd292d", "#eca02f", "#7a1919", "#d15555"];
    const datasets = (summarySeries.storesSeries || [])
      .slice(0, 5)
      .map((s, idx) => ({
        label: s.storeName,
        data: (s.data || []).map((v) => Number(v || 0)),
        borderColor: colors[idx % colors.length],
        backgroundColor: "transparent",
        tension: 0.28
      }));
    return { labels, datasets };
  }, [summarySeries.monthLabels, summarySeries.storesSeries]);

  const rankingBarData = useMemo(
    () => ({
      labels: (ranking.length ? ranking : stores.map((s) => ({ store_name: s.name, efficiency_score: 0 })))
        .filter((r) => (!activeStoreName ? true : r.store_name === activeStoreName))
        .map((r) => r.store_name),
      datasets: [
        {
          label: "Score de eficiência",
          data: (ranking.length ? ranking : stores.map(() => ({ efficiency_score: 0 })))
            .filter((r) => (!activeStoreName ? true : r.store_name === activeStoreName))
            .map((r) => Number(r.efficiency_score || 0)),
          backgroundColor: "#C0392B",
          borderRadius: 8
        }
      ]
    }),
    [ranking, stores, activeStoreName]
  );

  const supplierDonutData = useMemo(() => {
    const labels = (summarySeries.suppliersTop || []).map((x) => x.name);
    const data = (summarySeries.suppliersTop || []).map((x) => Number(x.spent || 0));
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ["#4b0c0c", "#cd292d", "#eca02f", "#7a1919", "#d15555", "#f2bf5f"],
          borderWidth: 1,
          borderColor: "#fff",
          hoverOffset: 8
        }
      ]
    };
  }, [summarySeries.suppliersTop]);

  const productBarsData = useMemo(() => {
    const rows = filteredProductRows.slice(0, 8);
    return {
      labels: rows.map((r) => r.store_name),
      datasets: [
        { label: "Min loja", data: rows.map((r) => Number(r.min_price || 0)), backgroundColor: "#F0A500", borderRadius: 8 },
        { label: "Média loja", data: rows.map((r) => Number(r.avg_price || 0)), backgroundColor: "#C0392B", borderRadius: 8 },
        { label: "Max loja", data: rows.map((r) => Number(r.max_price || 0)), backgroundColor: "#3D0A0A", borderRadius: 8 }
      ]
    };
  }, [filteredProductRows]);

  const filtersControls = (
    <>
      <div className="field field-styled">
        <label>Período (mês)</label>
        <select value={monthsFilter} onChange={(e) => setMonthsFilter(Number(e.target.value))}>
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
        </select>
      </div>
      <MultiSelectSearch
        label="Lojas"
        placeholder="Digite uma loja..."
        options={stores.map((s) => ({ value: s.id, label: s.name }))}
        value={activeStoreId}
        onChange={setActiveStoreId}
      />
      <MultiSelectSearch
        label="Produtos"
        placeholder="Digite um produto..."
        options={products.map((p) => ({ value: p.product_id || p.id, label: p.product_name || p.name }))}
        value={activeProductId}
        onChange={(next) => {
          setActiveProductId(next);
          setSelectedProduct(next.length === 1 ? next[0] : "");
        }}
      />
      <MultiSelectSearch
        label="Fornecedores"
        placeholder="Digite um fornecedor..."
        options={[...new Set(periodData.map((r) => r.supplier_name).filter(Boolean))].map((name) => ({ value: name, label: name }))}
        value={supplierFilter}
        onChange={setSupplierFilter}
      />
    </>
  );

  return (
    <AppShell title="Painel do Administrador" subtitle="Visao consolidada da rede e gestao de gerentes" links={links} activeLinkKey={tab}>

      {loading ? <p className="empty">Carregando...</p> : null}
      {error ? <p className="field-error">{error}</p> : null}

      {tab !== "opportunities" && tab !== "ranking" ? (
        <div className="admin-filters-wrap">
          <div className="opportunity-filters">{filtersControls}</div>
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <div className="grid">
          <section className="card span-12">
            <div className="kpi-grid-5 kpi-grid-extended">
              <KpiCardCompact label="Total gasto (recorte)" value={formatCurrency(kpis.totalSpent)} hint={`${monthsFilter} meses`} />
              <KpiCardCompact label="Lojas ativas (recorte)" value={kpis.storesActive} />
              <KpiCardCompact label="Compras (recorte)" value={kpis.purchasesCount} />
              <KpiCardCompact label="Ticket médio (recorte)" value={formatCurrency(kpis.avgTicket)} />
              <KpiCardCompact label="Fornecedores (recorte)" value={kpis.suppliersActive} />
              <KpiCardCompact label="Produtos (recorte)" value={kpis.productsAnalyzed} />
              <KpiCardCompact label="Quantidade total" value={Number(kpis.totalQty || 0).toFixed(2)} />
            </div>
          </section>

          <section className="span-4">
            <ChartCard
              title="Evolução de gastos por loja"
              subtitle={`Últimos ${monthsFilter} meses`}
              actions={<span className="badge badge-info">Período definido nos filtros</span>}
              height={300}
            >
              <Line
                data={spendingLineData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
                  layout: { padding: { top: 4, right: 6, left: 2, bottom: 0 } }
                }}
              />
            </ChartCard>
          </section>

          <section className="span-4">
            <ChartCard title="Ranking de eficiência da rede" subtitle="Best to worst" height={300}>
              <Bar
                data={rankingBarData}
                options={{
                  indexAxis: "y",
                  plugins: { legend: { display: false } },
                  responsive: true,
                  maintainAspectRatio: false,
                  layout: { padding: { top: 4, right: 8, left: 4, bottom: 4 } }
                }}
              />
            </ChartCard>
          </section>

          <section className="span-4">
            <ChartCard title="Distribuição por fornecedor" subtitle="Participação de gasto" height={300}>
              <Doughnut
                data={supplierDonutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "58%",
                  plugins: {
                    legend: {
                      position: "right",
                      align: "center",
                      labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 }, padding: 6 }
                    }
                  },
                  layout: { padding: { left: 4, right: 4, top: 4, bottom: 4 } }
                }}
              />
            </ChartCard>
          </section>

          {activeProductId ? (
            <section className="span-12">
              <DataCard
                title="Visão do produto no período"
                subtitle="Quantidade, gastos e últimas compras — respeita todos os filtros acima"
                footer={`Últimas ${Math.min(8, dashboardSummary?.recentPurchases?.length || 0)} compras neste recorte.`}
              >
                <div className="stats" style={{ marginBottom: "0.8rem" }}>
                  <div className="stat">
                    <span className="subtitle">Gasto total</span>
                    <strong>{formatCurrency(kpis.totalSpent)}</strong>
                  </div>
                  <div className="stat">
                    <span className="subtitle">Quantidade total</span>
                    <strong>{Number(kpis.totalQty || 0).toFixed(2)}</strong>
                  </div>
                  <div className="stat">
                    <span className="subtitle">Preço médio por compra</span>
                    <strong>{formatCurrency(kpis.avgTicket)}</strong>
                  </div>
                </div>

                <CompactTable
                  columns={[
                    {
                      id: "created_at",
                      label: "Data",
                      render: (r) => (
                        <span className="price-date">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "-"}
                        </span>
                      )
                    },
                    { id: "store_name", label: "Loja", render: (r) => <span className="price-store">{r.store_name}</span> },
                    { id: "supplier_name", label: "Fornecedor", render: (r) => <span className="badge badge-info">{r.supplier_name}</span> },
                    { id: "invoice_number", label: "NF", render: (r) => <span className="badge badge-warning">{r.invoice_number || "-"}</span> },
                    { id: "total", label: "Total", render: (r) => <span className="price-pill price-high">{formatCurrency(r.total || 0)}</span> }
                  ]}
                  rows={(dashboardSummary?.recentPurchases || []).slice(0, 8)}
                  keyField="purchase_id"
                  loading={loading}
                  emptyMessage="Sem compras para este produto no recorte selecionado."
                />
              </DataCard>
            </section>
          ) : null}

          <section className="span-12">
            <DataCard
              title="Top oportunidades"
              subtitle={activeProductId ? "Desvio de preço por loja (produto selecionado)" : "Lojas e produtos mais distantes do melhor preço da rede"}
              footer={`Mostrando ${topDashboardOpportunities.length} registros.`}
            >
              <CompactTable
                columns={[
                  { id: "store_name", label: "Loja", render: (r) => <span className="price-store">{r.store_name}</span> },
                  { id: "product_name", label: "Produto", render: (r) => <span className="badge badge-info">{r.product_name}</span> },
                  {
                    id: "store_avg_price",
                    label: "Média loja",
                    render: (r) => {
                      const avg = Number(r.store_avg_price || 0);
                      const net = Number(r.network_min_price || 0);
                      const diffPct = net > 0 ? ((avg - net) / net) * 100 : 0;
                      const cls = diffPct > 12 ? "price-high" : diffPct > 3 ? "price-mid" : "price-good";
                      return <span className={`price-pill ${cls}`}>{formatCurrency(avg)}</span>;
                    }
                  },
                  { id: "network_min_price", label: "Menor rede", render: (r) => <span className="price-pill price-network">{formatCurrency(r.network_min_price)}</span> },
                  { id: "above_best_percent", label: "Desvio", render: (r) => <BadgeValue value={r.above_best_percent} /> }
                ]}
                rows={topDashboardOpportunities}
                keyField={activeProductId ? "store_name" : "product_id"}
                loading={loading}
                emptyMessage="Sem oportunidades para este recorte."
              />
            </DataCard>
          </section>
        </div>
      ) : null}

      {tab === "stores" ? (
        <DataCard
          title="Gerentes e lojas vinculadas"
          actions={
            <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
              Convidar gerente
            </button>
          }
        >
          <CompactTable
            columns={[
              {
                id: "stores",
                label: "Loja",
                render: (r) =>
                  r.stores?.length ? (
                    <div className="table-chip-list">
                      {r.stores.map((s) => (
                        <span key={s.id || s.name} className="badge badge-info">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )
              },
              { id: "managerName", label: "Gerente", render: (r) => <span className="price-store">{r.managerName || "-"}</span> },
              { id: "email", label: "Email", render: (r) => <span className="table-email">{r.email}</span> },
              { id: "status", label: "Status", render: (r) => <span className={r.status === "ativo" ? "badge badge-info" : "badge badge-danger"}>{r.status}</span> },
              { id: "actions", label: "Convite", render: (r) => <button className="btn btn-ghost" onClick={() => resendInvite(r.id)}>Reenviar</button> }
            ]}
            rows={managers}
            keyField="id"
            loading={loading}
            emptyMessage="Nenhum gerente cadastrado."
          />
        </DataCard>
      ) : null}

      {tab === "ranking" ? (
        <RankingComparisonTab
          stores={stores}
          ranking={ranking}
          periodData={periodData}
          productComparisonRows={productComparisonRows}
          opportunities={opportunities}
          products={products}
          monthsFilter={monthsFilter}
          setMonthsFilter={setMonthsFilter}
          loading={loading}
        />
      ) : null}

      {tab === "opportunities" ? (
        <DataCard
          title="Mapa de oportunidades"
          subtitle="Comparação de preço pago por loja versus melhor referência da rede"
          footer={`Mostrando ${filteredOpportunities.length} registros para manter leitura rápida.`}
          actions={
            <div className="opportunities-head-actions">
              <span className="badge badge-warning">Economia potencial: {formatCurrency(potentialSavings)}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMonthsFilter(6);
                  setActiveStoreId([]);
                  setActiveProductId([]);
                  setSelectedProduct("");
                  setSupplierFilter([]);
                }}
              >
                Limpar
              </button>
            </div>
          }
        >
          <TableToolbar>
            <div className="opportunity-filters span-12">{filtersControls}</div>
          </TableToolbar>
          <CompactTable
            columns={[
              { id: "store_name", label: "Loja", render: (r) => <span className="price-store">{r.store_name}</span> },
              { id: "product_name", label: "Produto", render: (r) => <span className="badge badge-info">{r.product_name}</span> },
              {
                id: "store_avg_price",
                label: "Média loja",
                render: (r) => {
                  const avg = Number(r.store_avg_price || 0);
                  const net = Number(r.network_min_price || 0);
                  const diffPct = net > 0 ? ((avg - net) / net) * 100 : 0;
                  const cls = diffPct > 12 ? "price-high" : diffPct > 3 ? "price-mid" : "price-good";
                  return <span className={`price-pill ${cls}`}>{formatCurrency(avg)}</span>;
                }
              },
              { id: "network_min_price", label: "Menor rede", render: (r) => <span className="price-pill price-network">{formatCurrency(r.network_min_price)}</span> },
              { id: "best_store_name", label: "Loja melhor preço", render: (r) => <span className="badge badge-success">{r.best_store_name}</span> },
              { id: "above_best_percent", label: "Acima do melhor", render: (r) => <BadgeValue value={r.above_best_percent} /> },
              { id: "potential", label: "Economia/mês", render: (r) => <span className="price-pill price-good">{formatCurrency(Math.max(0, Number(r.store_avg_price) - Number(r.network_min_price)) * 30)}</span> }
            ]}
            rows={filteredOpportunities.map((r) => ({ ...r, __key: `${r.store_id}-${r.product_id}` }))}
            keyField="__key"
            loading={loading}
          />
        </DataCard>
      ) : null}

      {tab === "products" ? (
        <div className="grid">
          <section className="span-6">
            <ChartCard title="Preço por loja" subtitle="Use o filtro Produto acima para escolher o item" height={320}>
              <Line
                data={{
                  labels: filteredProductRows.slice(0, 8).map((r) => r.store_name),
                  datasets: [
                    {
                      label: "Preço médio",
                      data: filteredProductRows.slice(0, 8).map((r) => Number(r.avg_price || 0)),
                      borderColor: "#C0392B",
                      backgroundColor: "rgb(192 57 43 / 20%)",
                      fill: true,
                      tension: 0.3
                    }
                  ]
                }}
              />
            </ChartCard>
          </section>
          <section className="span-6">
            <ChartCard title="Min / Média / Máx por loja" subtitle="Produto selecionado" height={320}>
              <Bar data={productBarsData} />
            </ChartCard>
          </section>

          <section className="span-12">
            <DataCard title="Tabela comparativa de preço por loja" subtitle="Dados consolidados por loja/produto">
              <CompactTable
                columns={[
                  { id: "store_name", label: "Loja", render: (r) => <span className="price-store">{r.store_name}</span> },
                  { id: "product_name", label: "Produto", render: (r) => <span className="badge badge-info">{r.product_name}</span> },
                  {
                    id: "avg_price",
                    label: "Média loja",
                    render: (r) => {
                      const avg = Number(r.avg_price || 0);
                      const net = Number(r.network_min_price || 0);
                      const diffPct = net > 0 ? ((avg - net) / net) * 100 : 0;
                      const cls = diffPct > 12 ? "price-high" : diffPct > 3 ? "price-mid" : "price-good";
                      return <span className={`price-pill ${cls}`}>{formatCurrency(avg)}</span>;
                    }
                  },
                  { id: "min_price", label: "Min loja", render: (r) => <span className="price-pill price-good">{formatCurrency(r.min_price)}</span> },
                  { id: "max_price", label: "Max loja", render: (r) => <span className="price-pill price-high">{formatCurrency(r.max_price)}</span> },
                  { id: "network_min_price", label: "Menor rede", render: (r) => <span className="price-pill price-network">{formatCurrency(r.network_min_price)}</span> },
                  { id: "best_store_name", label: "Loja melhor preço", render: (r) => <span className="badge badge-success">{r.best_store_name}</span> },
                  {
                    id: "last_purchase_at",
                    label: "Última compra",
                    render: (r) => (
                      <span className="price-date">
                        {r.last_purchase_at ? new Date(r.last_purchase_at).toLocaleDateString("pt-BR") : "-"}
                      </span>
                    )
                  }
                ]}
                rows={filteredProductRows.slice(0, 40).map((r) => ({ ...r, __key: `${r.store_id}-${r.product_id}` }))}
                keyField="__key"
                loading={loading}
              />
            </DataCard>
          </section>
          <section className="span-12">
            <DataCard title="Comparador de fornecedor" subtitle="Ranking de gasto por fornecedor" footer={`Mostrando top ${supplierComparisonRows.length} por gasto.`}>
              <TableToolbar>
                <div className="span-12">
                  <MultiSelectSearch
                    label="Filtro de fornecedor"
                    placeholder="Digite e selecione..."
                    options={[...new Set(periodData.map((r) => r.supplier_name).filter(Boolean))].map((name) => ({ value: name, label: name }))}
                    value={supplierFilter}
                    onChange={setSupplierFilter}
                    maxChips={3}
                  />
                </div>
                <div className="field span-12">
                  <label>Mostrar no máximo</label>
                  <select value={supplierRowsLimit} onChange={(e) => setSupplierRowsLimit(Number(e.target.value))}>
                    <option value={8}>8 linhas</option>
                    <option value={12}>12 linhas</option>
                    <option value={20}>20 linhas</option>
                    <option value={30}>30 linhas</option>
                  </select>
                </div>
              </TableToolbar>
              <CompactTable
                columns={[
                  {
                    id: "rank",
                    label: "#",
                    render: (_r, idx) => <span className="badge badge-info">{idx + 1}</span>
                  },
                  { id: "store_name", label: "Loja" },
                  { id: "supplier_name", label: "Fornecedor" },
                  {
                    id: "share_store",
                    label: "% da loja",
                    render: (r) => {
                      const storeTotal = supplierComparisonTotals.byStore.get(r.store_name) || 0;
                      const pct = storeTotal ? (Number(r.total_spent || 0) / storeTotal) * 100 : 0;
                      return (
                        <div className="supplier-share">
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct)).toFixed(2)}%` }} />
                          </div>
                          <span className="supplier-share-pct">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    }
                  },
                  {
                    id: "share_total",
                    label: "% do recorte",
                    render: (r) => {
                      const pct = supplierComparisonTotals.total ? (Number(r.total_spent || 0) / supplierComparisonTotals.total) * 100 : 0;
                      return <span className="badge badge-warning">{pct.toFixed(0)}%</span>;
                    }
                  },
                  { id: "total_spent", label: "Total gasto", render: (r) => <strong style={{ color: "#3D0A0A" }}>{formatCurrency(r.total_spent)}</strong> }
                ]}
                rows={supplierComparisonRows.map((r) => ({ ...r, __key: `${r.store_id}-${r.supplier_name}` }))}
                keyField="__key"
                loading={loading}
              />
            </DataCard>
          </section>
        </div>
      ) : null}

      {tab === "products-admin" ? (
        <div className="grid">
          <section className="span-12">
            <DataCard title="Gestão de produtos (lista única da rede)" subtitle="Somente administrador cria, edita e remove produtos">
              <form className="grid" onSubmit={saveProduct}>
                <div className="field span-4">
                  <label>Nome</label>
                  <input value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="field span-3">
                  <SingleSelectInput
                    label="Categoria"
                    placeholder="Digite ou selecione..."
                    options={categoryOptions}
                    value={productForm.category}
                    onChange={(next) => setProductForm((p) => ({ ...p, category: next }))}
                  />
                </div>
                <div className="field span-2">
                  <label>Tipo</label>
                  <select value={productForm.type} onChange={(e) => setProductForm((p) => ({ ...p, type: e.target.value }))}>
                    <option value="insumo">Insumo</option>
                    <option value="venda">Venda</option>
                  </select>
                </div>
                <div className="field span-2">
                  <SingleSelectInput
                    label="Unidade padrão"
                    placeholder="Digite ou selecione..."
                    options={unitOptions}
                    value={productForm.standardUnit}
                    onChange={(next) => setProductForm((p) => ({ ...p, standardUnit: next }))}
                  />
                </div>
                <div className="field span-1" style={{ display: "flex", alignItems: "end", gap: "0.5rem" }}>
                  <button className="btn btn-primary" type="submit">{editingProductId ? "Salvar" : "Criar"}</button>
                  {editingProductId ? <button className="btn btn-ghost" type="button" onClick={resetProductForm}>Cancelar</button> : null}
                </div>
              </form>
            </DataCard>
          </section>
          <section className="span-12">
            <DataCard title="Lista global de produtos">
              <CompactTable
                columns={[
                  { id: "name", label: "Nome", render: (r) => <span className="badge badge-info">{r.name}</span> },
                  { id: "category", label: "Categoria" },
                  { id: "type", label: "Tipo", render: (r) => <span className={r.type === "venda" ? "badge badge-warning" : "badge badge-success"}>{r.type}</span> },
                  { id: "standard_unit", label: "Unidade" },
                  {
                    id: "actions",
                    label: "Ações",
                    render: (r) => (
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => {
                            setEditingProductId(r.id);
                            setProductForm({
                              name: r.name || "",
                              category: r.category || "",
                              type: r.type || "insumo",
                              standardUnit: r.standard_unit || "un"
                            });
                          }}
                        >
                          Editar
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => removeProduct(r.id)}>
                          <FaTrash />
                        </button>
                      </div>
                    )
                  }
                ]}
                rows={catalogProducts}
                keyField="id"
                loading={loading}
                emptyMessage="Nenhum produto cadastrado."
              />
            </DataCard>
          </section>
        </div>
      ) : null}

      {showInviteModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Convidar gerente</h3>
            <form onSubmit={inviteManager}>
              <div className="field">
                <label>Nome</label>
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Lojas vinculadas</label>
                <div className="card" style={{ borderTop: 0, boxShadow: "none", padding: "0.5rem", maxHeight: 180, overflow: "auto" }}>
                  {stores.map((store) => (
                    <label key={store.id} style={{ display: "block" }}>
                      <input type="checkbox" checked={selectedStoreIds.includes(store.id)} onChange={() => toggleStore(store.id)} /> {store.name}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowInviteModal(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" disabled={!inviteEmail || !inviteName || !selectedStoreIds.length}>
                  Enviar convite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </AppShell>
  );
}
