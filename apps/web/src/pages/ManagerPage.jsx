import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import AppShell from "../components/AppShell";
import ManagerAnalyticsDashboard from "../components/analytics/ManagerAnalyticsDashboard";
import ProductSalePricePanel from "../components/catalog/ProductSalePricePanel";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { api, withAuth } from "../api";
import { useAuth } from "../auth/AuthProvider";
import CompactTable from "../components/ui/CompactTable";
import { summarizePurchaseItems } from "../components/ui/tableCellUtils";
import DataCard from "../components/ui/DataCard";
import MultiSelectSearch from "../components/ui/MultiSelectSearch";
import TableToolbar from "../components/ui/TableToolbar";
import SupplierCrudPanel from "../components/catalog/SupplierCrudPanel";
import { formatCurrency } from "../lib/formatters";

export default function ManagerPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState("overview");
  const [history, setHistory] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [historyProductIds, setHistoryProductIds] = useState([]);
  const [historySupplierIds, setHistorySupplierIds] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [toast, setToast] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [historyRes, ledgerRes, productsRes, suppliersRes] = await Promise.all([
        api.get("/purchases/me", withAuth(token)),
        api.get("/purchases/me/ledger", withAuth(token)),
        api.get("/catalog/products", withAuth(token)),
        api.get("/catalog/suppliers", withAuth(token))
      ]);
      setHistory(historyRes.data || []);
      setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
      setProducts(productsRes.data?.length ? productsRes.data : []);
      setSuppliers(suppliersRes.data?.length ? suppliersRes.data : []);
    } catch {
      setError("Nao foi possivel carregar os dados. Verifique sua conexao ou tente novamente.");
      setProducts([]);
      setSuppliers([]);
      setHistory([]);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  useEffect(() => {
    if (token && tab === "history") void loadAll();
  }, [tab, token]);

  useEffect(() => {
    if (location.pathname !== "/manager") return;
    const qTab = new URLSearchParams(location.search).get("tab");
    if (qTab === "history" || qTab === "catalog") return setTab(qTab);
    setTab("overview");
  }, [location.pathname, location.search]);

  const links = useMemo(() => buildManagerSidebarLinks(navigate, setTab), [navigate]);

  const deleteDraft = useCallback(
    async (draftId) => {
      if (!window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.")) return;
      try {
        await api.delete(`/purchases/drafts/${draftId}`, withAuth(token));
        setToast("Rascunho excluído.");
        setTimeout(() => setToast(""), 2800);
        await loadAll();
      } catch (err) {
        setToast(err?.response?.data?.message || "Não foi possível excluir o rascunho.");
        setTimeout(() => setToast(""), 4500);
      }
    },
    [token]
  );

  const filteredLedger = (Array.isArray(ledger) ? ledger : []).filter((row) => {
    const q = historySearch.trim().toLowerCase();
    if (q) {
      const inv = String(row.invoiceNumber || "").toLowerCase();
      const sup = String(row.supplierName || "").toLowerCase();
      if (!inv.includes(q) && !sup.includes(q)) return false;
    }
    const dateOk =
      (!dateFrom || new Date(row.date) >= new Date(dateFrom)) &&
      (!dateTo || new Date(row.date) <= new Date(dateTo + "T23:59:59"));
    if (!dateOk) return false;
    if (row.kind === "draft") {
      const items = row.draft?.items || [];
      const productOk =
        !historyProductIds.length || items.some((it) => historyProductIds.includes(it.productId));
      const supplierOk =
        !historySupplierIds.length ||
        (row.draft?.supplierId && historySupplierIds.includes(row.draft.supplierId));
      return productOk && supplierOk;
    }
    const p = row.purchase;
    const items = p?.purchase_items || [];
    const productOk = !historyProductIds.length || items.some((it) => historyProductIds.includes(it.product_id));
    const supplierOk = !historySupplierIds.length || items.some((it) => historySupplierIds.includes(it.supplier_id));
    return productOk && supplierOk;
  });

  const refreshCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const [productsRes, suppliersRes] = await Promise.all([
        api.get("/catalog/products", withAuth(token)),
        api.get("/catalog/suppliers", withAuth(token))
      ]);
      setProducts(productsRes.data?.length ? productsRes.data : []);
      setSuppliers(suppliersRes.data?.length ? suppliersRes.data : []);
    } catch {
      setProducts([]);
      setSuppliers([]);
    }
  }, [token]);

  return (
    <AppShell
      title="Painel do Gerente"
      subtitle="Visualize a sua loja e os seus lançamentos"
      links={links}
      activeLinkKey={tab}
    >
      {toast ? <p className="toast-banner">{toast}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}

      {tab === "overview" ? (
        <ManagerAnalyticsDashboard token={token} products={products} suppliers={suppliers} />
      ) : null}

      {tab === "history" ? (
        <DataCard
          title="Histórico de compras"
          subtitle="Notas publicadas e rascunhos. Rascunhos podem ser editados ou excluídos; publicadas não podem ser apagadas."
          className="data-card--ledger-history"
        >
          <TableToolbar>
            <div className="field span-4">
              <label>Buscar NF ou fornecedor</label>
              <input
                type="search"
                placeholder="Ex.: 99999 ou Coca-Cola"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
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
                  setHistorySearch("");
                  setHistoryProductIds([]);
                  setHistorySupplierIds([]);
                }}
              >
                Limpar filtros
              </button>
            </div>
          </TableToolbar>
          <p className="ledger-table-scroll-hint" aria-hidden="true">
            Deslize a tabela para a direita para ver todas as colunas
          </p>
          <CompactTable
            scrollHorizontal
            mobileCompact={false}
            maxHeight={640}
            columns={[
              {
                id: "date",
                label: "Data",
                clamp: false,
                render: (row) => new Date(row.date).toLocaleDateString("pt-BR")
              },
              {
                id: "invoice",
                label: "NF",
                clamp: false,
                render: (row) => row.invoiceNumber || "n/d"
              },
              {
                id: "supplier",
                label: "Fornecedor",
                clamp: false,
                render: (row) => row.supplierName || "n/d"
              },
              {
                id: "status",
                label: "Estado",
                clamp: false,
                render: (row) =>
                  row.kind === "draft" ? (
                    <span className="ledger-badge ledger-badge--draft">Rascunho</span>
                  ) : (
                    <span className="ledger-badge ledger-badge--published">Publicada</span>
                  )
              },
              {
                id: "items",
                label: "Itens",
                clamp: false,
                render: (row) =>
                  row.kind === "draft"
                    ? `${row.itemCount} item(ns)`
                    : summarizePurchaseItems(row.purchase?.purchase_items) || "n/d"
              },
              {
                id: "receipt",
                label: "Anexo",
                clamp: false,
                render: (row) =>
                  row.receiptCount > 0 ? `${row.receiptCount} ficheiro(s)` : "Sem anexo"
              },
              {
                id: "actions",
                label: "Ações",
                render: (row) =>
                  row.kind === "draft" ? (
                    <div className="ledger-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm ledger-action-btn"
                        title="Anexar fotos da nota"
                        aria-label="Anexar fotos da nota"
                        onClick={() => navigate(`/manager/new-purchase?draft=${row.id}&step=4`)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm ledger-action-btn ledger-action-btn--danger"
                        title="Excluir rascunho"
                        aria-label="Excluir rascunho"
                        onClick={() => void deleteDraft(row.id)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ) : (
                    <span className="ledger-muted">n/d</span>
                  )
              }
            ]}
            rows={filteredLedger.slice(0, 50).map((row) => ({ ...row, ledgerKey: `${row.kind}-${row.id}` }))}
            keyField="ledgerKey"
            loading={loading}
            emptyMessage="Nenhuma nota encontrada."
          />
        </DataCard>
      ) : null}

      {tab === "catalog" ? (
        <div className="grid catalog-page-grid">
          <section className="span-12">
            <DataCard
              title="Preço de venda"
              subtitle="Informe o preço de venda para calcular margem estimada no dashboard Financeiro."
            >
              <ProductSalePricePanel
                token={token}
                products={products}
                onRefresh={refreshCatalog}
                onToast={(msg) => {
                  setToast(msg);
                  setTimeout(() => setToast(""), 4000);
                }}
              />
            </DataCard>
          </section>
          <section className="span-12">
            <DataCard title="Produtos" subtitle="Catálogo da rede (consulta). Para criar produto novo, use o registo de compra.">
              <CompactTable
                columns={[
                  { id: "name", label: "Nome" },
                  { id: "category", label: "Categoria" },
                  { id: "type", label: "Tipo", render: (p) => p.type || "n/d" },
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
            <DataCard title="Fornecedores" subtitle="Fornecedores da sua loja  ·  adicione, edite ou remova.">
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
