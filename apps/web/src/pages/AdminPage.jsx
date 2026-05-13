import { useEffect, useMemo, useState } from "react";
import { FaBalanceScale, FaChartBar, FaChartLine, FaCog, FaEdit, FaLightbulb, FaLink, FaStore, FaTrash, FaUserCog } from "react-icons/fa";
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
import { supabase } from "../supabase";
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
  const { token, user } = useAuth();
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
  const [suppliersAll, setSuppliersAll] = useState([]);
  const [supplierAliases, setSupplierAliases] = useState([]);
  const [supplierAliasesPending, setSupplierAliasesPending] = useState([]);
  const [aliasForm, setAliasForm] = useState({ supplierId: "", labelRaw: "", productId: "" });
  const [periodData, setPeriodData] = useState([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [inviteNewStoreOpen, setInviteNewStoreOpen] = useState(false);
  const [quickStore, setQuickStore] = useState({
    cnpj: "",
    name: "",
    location: "",
    storeNumber: "",
    managerName: ""
  });
  const [quickStoreSaving, setQuickStoreSaving] = useState(false);
  const [storeEditor, setStoreEditor] = useState(null);
  const [managerEditor, setManagerEditor] = useState(null);
  const [adminSettings, setAdminSettings] = useState({ email: "", displayName: "", password: "" });
  const [adminSettingsSaving, setAdminSettingsSaving] = useState(false);
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
      const [s, r, o, p, m, period, comparison, summary, catalogProductsRes, categoriesRes, catalogSuppliersRes, supplierAliasesRes, supplierAliasesPendingRes] =
        await Promise.all([
        api.get("/catalog/stores", withAuth(token)),
        api.get("/dashboards/stores", withAuth(token)),
        api.get("/admin/comparisons/opportunities", withAuth(token)),
        api.get("/dashboards/products", withAuth(token)),
        api.get("/auth/admin/managers", withAuth(token)),
        api.get(`/dashboards/period?months=${monthsFilter}`, withAuth(token)),
        api.get("/admin/products/comparison", withAuth(token)),
        api.get(`/admin/dashboard/summary?${dashboardFilterQuery}`, withAuth(token)),
        api.get("/catalog/products", withAuth(token)),
        api.get("/catalog/categories", withAuth(token)),
        api.get("/catalog/suppliers", withAuth(token)),
        api.get("/catalog/supplier-product-aliases", withAuth(token)),
        api.get("/catalog/supplier-product-aliases?source=auto_pending", withAuth(token))
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
      setSuppliersAll(catalogSuppliersRes.data || []);
      setSupplierAliases(supplierAliasesRes.data || []);
      setSupplierAliasesPending(supplierAliasesPendingRes.data || []);
      const opportunitiesRows = (o.data || []).length ? o.data : deriveOpportunitiesFromComparison(comparisonRows);
      setOpportunities(opportunitiesRows);
      setDashboardSummary(summary.data || null);
    } catch {
      setError("Nao foi possivel carregar todos os dados. Tente novamente.");
      setStores([]);
      setProducts([]);
      setRanking([]);
      setManagers([]);
      setPeriodData([]);
      setProductComparisonRows([]);
      setCatalogProducts([]);
      setCategories([]);
      setSuppliersAll([]);
      setSupplierAliases([]);
      setSupplierAliasesPending([]);
      setOpportunities([]);
      setDashboardSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAll();
  }, [token, monthsFilter, dashboardFilterQuery]);

  useEffect(() => {
    if (tab !== "settings" || !user) return;
    setAdminSettings({
      email: user.email || "",
      displayName: user.displayName || "",
      password: ""
    });
  }, [tab, user?.email, user?.displayName]);

  async function inviteManager(e) {
    e.preventDefault();
    try {
      await api.post(
        "/auth/invite-manager",
        { managerName: inviteName, email: inviteEmail, storeIds: selectedStoreIds },
        withAuth(token)
      );
      setToast("Convite enviado com sucesso.");
      setInviteName("");
      setInviteEmail("");
      setSelectedStoreIds([]);
      setInviteNewStoreOpen(false);
      setQuickStore({ cnpj: "", name: "", location: "", storeNumber: "", managerName: "" });
      setShowInviteModal(false);
      await loadAll();
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.formErrors?.email?.[0] || "Falha ao enviar convite.";
      setToast(typeof msg === "string" ? msg : "Falha ao enviar convite.");
      setTimeout(() => setToast(""), 4000);
    }
  }

  async function saveQuickStoreInInvite() {
    const digits = String(quickStore.cnpj || "").replace(/\D/g, "");
    const sn = parseInt(String(quickStore.storeNumber).replace(/\D/g, ""), 10);
    if (digits.length < 14 || !quickStore.name.trim() || !quickStore.location.trim() || !Number.isFinite(sn) || sn < 1) {
      setToast("Preencha CNPJ (14 dígitos), nome, localização e número da loja.");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setQuickStoreSaving(true);
    try {
      const { data } = await api.post(
        "/catalog/stores",
        {
          cnpj: digits,
          name: quickStore.name.trim(),
          location: quickStore.location.trim(),
          storeNumber: sn,
          managerName: (quickStore.managerName.trim() || inviteName.trim() || "Responsável pela loja").slice(0, 120)
        },
        withAuth(token)
      );
      await loadAll();
      if (data?.id) setSelectedStoreIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      setQuickStore({ cnpj: "", name: "", location: "", storeNumber: "", managerName: "" });
      setToast("Loja criada e selecionada para o convite.");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || "Não foi possível criar a loja.";
      setToast(typeof msg === "string" ? msg : "Não foi possível criar a loja.");
      setTimeout(() => setToast(""), 4000);
    } finally {
      setQuickStoreSaving(false);
    }
  }

  async function saveStoreEditor(e) {
    e.preventDefault();
    if (!storeEditor) return;
    const digits = String(storeEditor.cnpj || "").replace(/\D/g, "");
    const sn = Number(storeEditor.storeNumber);
    if (digits.length < 14 || !storeEditor.name?.trim() || !storeEditor.location?.trim() || !Number.isFinite(sn)) return;
    try {
      const body = {
        cnpj: digits,
        name: storeEditor.name.trim(),
        location: storeEditor.location.trim(),
        storeNumber: sn,
        managerName: (storeEditor.managerName || "").trim() || "—",
        phone: storeEditor.phone?.trim() || null,
        openingHours: storeEditor.openingHours?.trim() || null,
        onboardingNotes: storeEditor.onboardingNotes?.trim() || null
      };
      if (storeEditor.mode === "create") {
        await api.post("/catalog/stores", body, withAuth(token));
        setToast("Loja criada.");
      } else {
        await api.put(`/catalog/stores/${storeEditor.id}`, body, withAuth(token));
        setToast("Loja atualizada.");
      }
      setStoreEditor(null);
      await loadAll();
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao guardar loja.";
      setToast(typeof msg === "string" ? msg : "Erro ao guardar loja.");
      setTimeout(() => setToast(""), 4000);
    }
  }

  async function deleteStoreRow(storeId) {
    if (!window.confirm("Remover esta loja do sistema? (Só funciona se não houver dados dependentes.)")) return;
    try {
      await api.delete(`/catalog/stores/${storeId}`, withAuth(token));
      setSelectedStoreIds((prev) => prev.filter((id) => id !== storeId));
      setToast("Loja removida.");
      await loadAll();
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || "Não foi possível remover (verifique compras ou vínculos).";
      setToast(typeof msg === "string" ? msg : "Não foi possível remover.");
      setTimeout(() => setToast(""), 4000);
    }
  }

  function openStoreEditorCreate() {
    setStoreEditor({
      mode: "create",
      cnpj: "",
      name: "",
      location: "",
      storeNumber: "",
      managerName: "",
      phone: "",
      openingHours: "",
      onboardingNotes: ""
    });
  }

  function openStoreEditorEdit(s) {
    setStoreEditor({
      mode: "edit",
      id: s.id,
      cnpj: s.cnpj || "",
      name: s.name || "",
      location: s.location || "",
      storeNumber: s.store_number ?? "",
      managerName: s.manager_name || "",
      phone: s.phone || "",
      openingHours: s.opening_hours || "",
      onboardingNotes: s.onboarding_notes || ""
    });
  }

  function openManagerEditor(m) {
    const ids = m.storeIds?.length ? m.storeIds : (m.stores || []).map((s) => s.id).filter(Boolean);
    setManagerEditor({
      id: m.id,
      email: m.email || "",
      managerName: m.managerName || "",
      storeIds: ids,
      password: ""
    });
  }

  async function saveManagerEditor(e) {
    e.preventDefault();
    if (!managerEditor) return;
    if (!managerEditor.storeIds.length) {
      setToast("Selecione pelo menos uma loja.");
      setTimeout(() => setToast(""), 2500);
      return;
    }
    try {
      const payload = {
        managerName: managerEditor.managerName.trim(),
        storeIds: managerEditor.storeIds,
        email: managerEditor.email.trim() || undefined,
        password: managerEditor.password.trim().length >= 8 ? managerEditor.password.trim() : undefined
      };
      await api.put(`/auth/admin/managers/${managerEditor.id}`, payload, withAuth(token));
      setManagerEditor(null);
      setToast("Gerente atualizado.");
      await loadAll();
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao atualizar gerente.";
      setToast(typeof msg === "string" ? msg : "Erro ao atualizar gerente.");
      setTimeout(() => setToast(""), 4000);
    }
  }

  async function deleteManagerRow(managerId) {
    if (!window.confirm("Remover este gerente (Auth) e vínculos com lojas?")) return;
    try {
      await api.delete(`/auth/admin/managers/${managerId}`, withAuth(token));
      setToast("Gerente removido.");
      await loadAll();
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao remover.";
      setToast(typeof msg === "string" ? msg : "Erro ao remover.");
      setTimeout(() => setToast(""), 4000);
    }
  }

  async function saveAdminSettings(e) {
    e.preventDefault();
    const body = {};
    if (adminSettings.email.trim() && adminSettings.email.trim() !== user?.email) body.email = adminSettings.email.trim();
    if (adminSettings.password.trim().length >= 8) body.password = adminSettings.password.trim();
    if (adminSettings.displayName.trim()) body.displayName = adminSettings.displayName.trim();
    if (!Object.keys(body).length) {
      setToast("Altere e-mail, nome ou senha (mín. 8 caracteres) antes de guardar.");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setAdminSettingsSaving(true);
    try {
      await api.patch("/auth/admin/me", body, withAuth(token));
      setToast("Conta atualizada. A atualizar sessão…");
      await supabase.auth.refreshSession();
      setAdminSettings((f) => ({ ...f, password: "" }));
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao atualizar conta.";
      setToast(typeof msg === "string" ? msg : "Erro ao atualizar conta.");
      setTimeout(() => setToast(""), 4000);
    } finally {
      setAdminSettingsSaving(false);
    }
  }

  async function resendInvite(managerId) {
    await api.post(`/auth/admin/managers/${managerId}/resend-invite`, {}, withAuth(token));
    setToast("Convite reenviado.");
    setTimeout(() => setToast(""), 2500);
  }

  function toggleStore(storeId) {
    setSelectedStoreIds((prev) => (prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]));
  }

  function toggleManagerStore(storeId) {
    setManagerEditor((prev) => {
      if (!prev) return prev;
      const has = prev.storeIds.includes(storeId);
      return { ...prev, storeIds: has ? prev.storeIds.filter((id) => id !== storeId) : [...prev.storeIds, storeId] };
    });
  }

  const links = [
    { key: "dashboard", label: "Dashboard da Rede", icon: <FaChartBar />, onClick: () => setTab("dashboard") },
    { key: "stores", label: "Lojas & Gerentes", icon: <FaStore />, onClick: () => setTab("stores") },
    { key: "opportunities", label: "Oportunidades", icon: <FaLightbulb />, onClick: () => setTab("opportunities") },
    { key: "products", label: "Análise", icon: <FaChartLine />, onClick: () => setTab("products") },
    { key: "ranking", label: "Comparação", icon: <FaBalanceScale />, onClick: () => setTab("ranking") },
    { key: "products-admin", label: "Produtos", icon: <FaCog />, onClick: () => setTab("products-admin") },
    { key: "supplier-aliases", label: "NF → produto (fornecedor)", icon: <FaLink />, onClick: () => setTab("supplier-aliases") },
    { key: "settings", label: "Configuracoes", icon: <FaUserCog />, onClick: () => setTab("settings") }
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

  async function saveSupplierAlias(e) {
    e.preventDefault();
    if (!aliasForm.supplierId || !aliasForm.labelRaw.trim() || !aliasForm.productId) return;
    await api.post(
      "/catalog/supplier-product-aliases",
      {
        supplierId: aliasForm.supplierId,
        labelRaw: aliasForm.labelRaw.trim(),
        productId: aliasForm.productId
      },
      withAuth(token)
    );
    setToast("Mapeamento gravado.");
    setAliasForm({ supplierId: "", labelRaw: "", productId: "" });
    await loadAll();
    setTimeout(() => setToast(""), 2200);
  }

  async function removeSupplierAliasRow(id) {
    if (!window.confirm("Remover este mapeamento?")) return;
    await api.delete(`/catalog/supplier-product-aliases/${id}`, withAuth(token));
    setToast("Mapeamento removido.");
    await loadAll();
    setTimeout(() => setToast(""), 2200);
  }

  async function approvePendingAlias(row) {
    const raw =
      (row.label_raw && String(row.label_raw).trim()) || (row.label_normalized && String(row.label_normalized).trim());
    if (!raw || !row.supplier_id || !row.product_id) return;
    await api.post(
      "/catalog/supplier-product-aliases",
      { supplierId: row.supplier_id, labelRaw: raw, productId: row.product_id },
      withAuth(token)
    );
    setToast("Sugestão aprovada: mapeamento confirmado como admin.");
    await loadAll();
    setTimeout(() => setToast(""), 2200);
  }

  async function rejectPendingAlias(row) {
    if (!window.confirm("Rejeitar esta sugestão e remover o registo pendente?")) return;
    await api.delete(`/catalog/supplier-product-aliases/${row.id}`, withAuth(token));
    setToast("Sugestão rejeitada.");
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

      {tab !== "opportunities" && tab !== "ranking" && tab !== "settings" && tab !== "stores" ? (
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
                      position: "bottom",
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
        <div className="grid">
          <DataCard
            title="Lojas da rede"
            subtitle="CRUD completo: cada loja pode estar ligada a um único gerente."
            actions={
              <button type="button" className="btn btn-secondary" onClick={openStoreEditorCreate}>
                Nova loja
              </button>
            }
          >
            <CompactTable
              columns={[
                { id: "store_number", label: "Nº", render: (s) => s.store_number },
                { id: "name", label: "Nome" },
                { id: "location", label: "Local" },
                { id: "cnpj", label: "CNPJ", render: (s) => s.cnpj },
                { id: "manager_name", label: "Resp. loja", render: (s) => s.manager_name || "—" },
                {
                  id: "actions",
                  label: "",
                  render: (s) => (
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-ghost" title="Editar" onClick={() => openStoreEditorEdit(s)}>
                        <FaEdit />
                      </button>
                      <button type="button" className="btn btn-ghost" title="Remover" onClick={() => deleteStoreRow(s.id)}>
                        <FaTrash />
                      </button>
                    </div>
                  )
                }
              ]}
              rows={stores}
              keyField="id"
              loading={loading}
              emptyMessage="Nenhuma loja. Crie uma aqui ou ao convidar um gerente."
            />
          </DataCard>

          <DataCard
            title="Gerentes"
            subtitle="Editar e-mail, senha, nome e lojas vinculadas. Convite por e-mail continua disponível."
            actions={
              <button type="button" className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
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
                {
                  id: "actions",
                  label: "Ações",
                  render: (r) => (
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" className="btn btn-ghost" title="Editar" onClick={() => openManagerEditor(r)}>
                        <FaEdit />
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => resendInvite(r.id)}>
                        Reenviar convite
                      </button>
                      <button type="button" className="btn btn-ghost" title="Remover" onClick={() => deleteManagerRow(r.id)}>
                        <FaTrash />
                      </button>
                    </div>
                  )
                }
              ]}
              rows={managers}
              keyField="id"
              loading={loading}
              emptyMessage="Nenhum gerente cadastrado."
            />
          </DataCard>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid">
          <section className="span-12">
            <DataCard title="Minha conta" subtitle="Altere o seu e-mail, nome de exibição ou senha de acesso (Supabase Auth).">
              <form className="grid" onSubmit={saveAdminSettings}>
                <div className="field span-6">
                  <label>E-mail</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={adminSettings.email}
                    onChange={(e) => setAdminSettings((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="field span-6">
                  <label>Nome de exibição</label>
                  <input
                    value={adminSettings.displayName}
                    onChange={(e) => setAdminSettings((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Como aparece no painel"
                  />
                </div>
                <div className="field span-6">
                  <label>Nova senha (opcional)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={adminSettings.password}
                    onChange={(e) => setAdminSettings((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres se quiser alterar"
                  />
                </div>
                <div className="field span-12">
                  <button type="submit" className="btn btn-primary" disabled={adminSettingsSaving}>
                    {adminSettingsSaving ? "A guardar…" : "Guardar alterações"}
                  </button>
                </div>
              </form>
            </DataCard>
          </section>
        </div>
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
            <DataCard title="Gestão de produtos (lista única da rede)" subtitle="Administrador mantém o catálogo completo. Produtos criados por gerentes (criação rápida) surgem em “Outros” e aparecem como origem “Gerente” na tabela.">
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
                  {
                    id: "created_by",
                    label: "Origem",
                    render: (r) =>
                      r.created_by === "manager" ? (
                        <span className="badge badge-warning" title="Criado pelo fluxo rápido na compra">
                          Gerente
                        </span>
                      ) : (
                        <span className="badge badge-success">Admin</span>
                      )
                  },
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

      {tab === "supplier-aliases" ? (
        <div className="grid">
          <section className="span-12">
            <DataCard
              title="Pendências de revisão (match médio)"
              subtitle="Sugestões gravadas automaticamente quando o texto da nota ou o registo rápido casou com um produto por fuzzy intermédio. Aprovar confirma o mapeamento; rejeitar remove só esta sugestão."
            >
              <CompactTable
                columns={[
                  { id: "supplier_name", label: "Fornecedor" },
                  { id: "label_raw", label: "Texto", render: (r) => r.label_raw || r.label_normalized || "—" },
                  { id: "product_name", label: "Produto sugerido" },
                  {
                    id: "confidence",
                    label: "Confiança",
                    render: (r) => (r.confidence != null ? `${(Number(r.confidence) * 100).toFixed(0)}%` : "—")
                  },
                  {
                    id: "actions",
                    label: "",
                    render: (r) => (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-primary" onClick={() => approvePendingAlias(r)}>
                          Aprovar
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => rejectPendingAlias(r)}>
                          Rejeitar
                        </button>
                      </div>
                    )
                  }
                ]}
                rows={supplierAliasesPending}
                keyField="id"
                loading={loading}
                emptyMessage="Nenhuma pendência. Sugestões médias aparecem após leitura de NF ou uso do registo rápido com fornecedor escolhido."
              />
            </DataCard>
          </section>
          <section className="span-12">
            <DataCard
              title="Mapeamento nota → produto (por fornecedor)"
              subtitle="Quando o texto da NF ou da digitação bater com o rótulo normalizado, o sistema usa o produto canónico. Útil para variações como “CONTRA FILE” vs “Contrafilé”. A IA e o registo rápido usam isto automaticamente se o fornecedor já estiver escolhido na compra."
            >
              <form className="grid" onSubmit={saveSupplierAlias}>
                <div className="field span-4">
                  <SingleSelectInput
                    label="Fornecedor"
                    placeholder="Selecione..."
                    options={(suppliersAll || []).map((x) => ({ value: x.id, label: x.name }))}
                    value={aliasForm.supplierId}
                    onChange={(next) => setAliasForm((f) => ({ ...f, supplierId: next }))}
                  />
                </div>
                <div className="field span-4">
                  <SingleSelectInput
                    label="Produto canónico"
                    placeholder="Selecione..."
                    options={(catalogProducts || []).map((x) => ({ value: x.id, label: x.name }))}
                    value={aliasForm.productId}
                    onChange={(next) => setAliasForm((f) => ({ ...f, productId: next }))}
                  />
                </div>
                <div className="field span-4">
                  <label>Texto da nota (como aparece)</label>
                  <input
                    value={aliasForm.labelRaw}
                    onChange={(e) => setAliasForm((f) => ({ ...f, labelRaw: e.target.value }))}
                    placeholder="Ex.: CONTRA FILE RESF KG"
                    required
                  />
                </div>
                <div className="field span-12">
                  <button className="btn btn-primary" type="submit">
                    Guardar mapeamento
                  </button>
                </div>
              </form>
            </DataCard>
          </section>
          <section className="span-12">
            <DataCard title="Mapeamentos existentes (últimos 500)">
              <CompactTable
                columns={[
                  { id: "supplier_name", label: "Fornecedor" },
                  { id: "label_normalized", label: "Chave normalizada" },
                  { id: "label_raw", label: "Texto original", render: (r) => r.label_raw || "—" },
                  { id: "product_name", label: "Produto" },
                  {
                    id: "source",
                    label: "Origem",
                    render: (r) => (
                      <span className={r.source === "admin" ? "badge badge-success" : "badge badge-info"}>{r.source || "—"}</span>
                    )
                  },
                  { id: "use_count", label: "Usos" },
                  {
                    id: "actions",
                    label: "",
                    render: (r) => (
                      <button type="button" className="btn btn-ghost" title="Remover" onClick={() => removeSupplierAliasRow(r.id)}>
                        <FaTrash />
                      </button>
                    )
                  }
                ]}
                rows={supplierAliases}
                keyField="id"
                loading={loading}
                emptyMessage="Nenhum mapeamento. Crie pelo formulário acima ou deixe o sistema gravar aliases automáticos (fuzzy alto) ao ler notas."
              />
            </DataCard>
          </section>
        </div>
      ) : null}

      {showInviteModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: "32rem" }}>
            <h3>Convidar gerente</h3>
            <form onSubmit={inviteManager}>
              <div className="field">
                <label>Nome</label>
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label>Lojas vinculadas</label>
                <div className="card" style={{ borderTop: 0, boxShadow: "none", padding: "0.5rem", maxHeight: 180, overflow: "auto" }}>
                  {stores.length === 0 ? (
                    <p className="empty" style={{ margin: 0 }}>
                      Nenhuma loja ainda. Use &quot;Cadastrar nova loja&quot; abaixo.
                    </p>
                  ) : (
                    stores.map((store) => (
                      <label key={store.id} style={{ display: "block" }}>
                        <input type="checkbox" checked={selectedStoreIds.includes(store.id)} onChange={() => toggleStore(store.id)} />{" "}
                        {store.name} (nº {store.store_number})
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="field">
                <button type="button" className="btn btn-link" style={{ padding: 0 }} onClick={() => setInviteNewStoreOpen((v) => !v)}>
                  {inviteNewStoreOpen ? "Ocultar cadastro de loja" : "+ Cadastrar nova loja (e selecionar)"}
                </button>
              </div>
              {inviteNewStoreOpen ? (
                <div className="card" style={{ padding: "0.75rem", marginBottom: "0.75rem" }}>
                  <p className="subtitle" style={{ marginTop: 0 }}>
                    Cria a loja na rede e adiciona à seleção deste convite.
                  </p>
                  <div className="field">
                    <label>CNPJ (14 dígitos)</label>
                    <input value={quickStore.cnpj} onChange={(e) => setQuickStore((q) => ({ ...q, cnpj: e.target.value }))} placeholder="Somente números" />
                  </div>
                  <div className="field">
                    <label>Nome da loja</label>
                    <input value={quickStore.name} onChange={(e) => setQuickStore((q) => ({ ...q, name: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Localização / bairro</label>
                    <input value={quickStore.location} onChange={(e) => setQuickStore((q) => ({ ...q, location: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Número da loja (código rede)</label>
                    <input
                      type="number"
                      min={1}
                      value={quickStore.storeNumber}
                      onChange={(e) => setQuickStore((q) => ({ ...q, storeNumber: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Nome do responsável na loja (opcional)</label>
                    <input
                      value={quickStore.managerName}
                      onChange={(e) => setQuickStore((q) => ({ ...q, managerName: e.target.value }))}
                      placeholder="Se vazio, usa o nome do gerente ou “Responsável pela loja”"
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" disabled={quickStoreSaving} onClick={() => saveQuickStoreInInvite()}>
                    {quickStoreSaving ? "A criar…" : "Cadastrar loja e selecionar"}
                  </button>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowInviteModal(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="submit" disabled={!inviteEmail || !inviteName || !selectedStoreIds.length}>
                  Enviar convite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {storeEditor ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: "28rem" }}>
            <h3>{storeEditor.mode === "create" ? "Nova loja" : "Editar loja"}</h3>
            <form onSubmit={saveStoreEditor}>
              <div className="field">
                <label>CNPJ (14 dígitos)</label>
                <input value={storeEditor.cnpj} onChange={(e) => setStoreEditor((s) => ({ ...s, cnpj: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Nome</label>
                <input value={storeEditor.name} onChange={(e) => setStoreEditor((s) => ({ ...s, name: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Localização</label>
                <input value={storeEditor.location} onChange={(e) => setStoreEditor((s) => ({ ...s, location: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Número da loja</label>
                <input
                  type="number"
                  min={1}
                  value={storeEditor.storeNumber}
                  onChange={(e) => setStoreEditor((s) => ({ ...s, storeNumber: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Responsável (campo da loja)</label>
                <input value={storeEditor.managerName} onChange={(e) => setStoreEditor((s) => ({ ...s, managerName: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Telefone (opcional)</label>
                <input value={storeEditor.phone} onChange={(e) => setStoreEditor((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="field">
                <label>Horário (opcional)</label>
                <input value={storeEditor.openingHours} onChange={(e) => setStoreEditor((s) => ({ ...s, openingHours: e.target.value }))} />
              </div>
              <div className="field">
                <label>Notas onboarding (opcional)</label>
                <textarea value={storeEditor.onboardingNotes} onChange={(e) => setStoreEditor((s) => ({ ...s, onboardingNotes: e.target.value }))} rows={2} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setStoreEditor(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {managerEditor ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: "32rem" }}>
            <h3>Editar gerente</h3>
            <form onSubmit={saveManagerEditor}>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={managerEditor.email} onChange={(e) => setManagerEditor((m) => ({ ...m, email: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Nome do gerente</label>
                <input value={managerEditor.managerName} onChange={(e) => setManagerEditor((m) => ({ ...m, managerName: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Nova senha (opcional)</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={managerEditor.password}
                  onChange={(e) => setManagerEditor((m) => ({ ...m, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres; vazio = não alterar"
                />
              </div>
              <div className="field">
                <label>Lojas vinculadas</label>
                <p className="field-helper">Cada loja só pode ter um gerente; ao guardar, vínculos antigos dessas lojas são transferidos.</p>
                <div className="card" style={{ borderTop: 0, boxShadow: "none", padding: "0.5rem", maxHeight: 200, overflow: "auto" }}>
                  {stores.map((store) => (
                    <label key={store.id} style={{ display: "block" }}>
                      <input type="checkbox" checked={managerEditor.storeIds.includes(store.id)} onChange={() => toggleManagerStore(store.id)} />{" "}
                      {store.name} (nº {store.store_number})
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setManagerEditor(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar gerente
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
