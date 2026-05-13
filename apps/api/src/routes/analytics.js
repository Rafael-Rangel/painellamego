import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { getManagerStoreIds } from "../services/scopeService.js";

const router = Router();

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonthsLabels(n = 12) {
  const now = new Date();
  const labels = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return labels;
}

function cutoffDateFromMonths(months) {
  const m = Number(months || 6);
  const now = new Date();
  // Começa no 1º dia do mês (m-1) meses atrás, para bater com gráficos mensais.
  return new Date(now.getFullYear(), now.getMonth() - (m - 1), 1);
}

router.get("/comparisons/products/:id", requireAuth, async (req, res) => {
  const { data: snapshot, error } = await supabaseAdmin
    .from("price_snapshots")
    .select("*")
    .eq("product_id", req.params.id)
    .single();
  if (error) return res.status(400).json({ message: error.message });

  const { data: details } = await supabaseAdmin
    .from("v_product_store_prices")
    .select("*")
    .eq("product_id", req.params.id)
    .order("unit_price", { ascending: true });

  return res.json({ snapshot, details });
});

router.get("/dashboards/stores", requireAuth, async (req, res) => {
  let query = supabaseAdmin.from("v_store_efficiency_ranking").select("*").order("efficiency_score", {
    ascending: false
  });
  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (!storeIds.length) return res.json([]);
    query = query.in("store_id", storeIds);
  }
  const { data, error } = await query;
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

router.get("/dashboards/products", requireAuth, async (_req, res) => {
  let data;
  let error;
  if (_req.user.role === "admin") {
    ({ data, error } = await supabaseAdmin
      .from("v_product_price_stats")
      .select("*")
      .order("last_purchase_at", { ascending: false }));
  } else {
    const storeIds = await getManagerStoreIds(_req.user);
    if (!storeIds.length) return res.json([]);
    ({ data, error } = await supabaseAdmin
      .from("v_store_product_price_stats")
      .select("*")
      .in("store_id", storeIds)
      .order("last_purchase_at", { ascending: false }));
  }
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

router.get("/dashboards/period", requireAuth, async (req, res) => {
  const months = Number(req.query.months ?? 6);
  const { data, error } = await supabaseAdmin.rpc("fn_period_summary", { p_months: months });
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

/**
 * Dashboard admin filtrado (KPIs + séries) por:
 * - months: 3/6/12
 * - storeId: uuid (opcional)
 * - productId: uuid (opcional)
 * - supplier: texto (opcional, compara por nome)
 * - storeText: texto (opcional, compara por nome da loja)
 */
router.get("/admin/dashboard/summary", requireAuth, requireAdmin, async (req, res) => {
  const months = Number(req.query.months ?? 6);
  const storeIds = (req.query.storeIds || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const productIds = (req.query.productIds || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const suppliers = (req.query.suppliers || "")
    .toString()
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const cutoff = cutoffDateFromMonths(months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let itemsQuery = supabaseAdmin
    .from("purchase_items")
    .select(
      "purchase_id, store_id, product_id, supplier_id, unit_price, quantity, purchase_date, line_type, purchases(invoice_number, created_at), suppliers(name), products(name)"
    )
    .gte("purchase_date", cutoffStr);

  if (storeIds.length) itemsQuery = itemsQuery.in("store_id", storeIds);
  if (productIds.length) itemsQuery = itemsQuery.in("product_id", productIds);

  const { data: itemRows, error: itemsError } = await itemsQuery;
  if (itemsError) return res.status(400).json({ message: itemsError.message });

  // Carrega nomes de loja (para gráficos).
  const storeIdsFromData = [...new Set((itemRows || []).map((r) => r.store_id).filter(Boolean))];
  let storesMap = new Map();
  if (storeIdsFromData.length) {
    const { data: storesRows, error: storesError } = await supabaseAdmin
      .from("stores")
      .select("id, name, store_number")
      .in("id", storeIdsFromData);
    if (storesError) return res.status(400).json({ message: storesError.message });
    storesMap = new Map((storesRows || []).map((s) => [s.id, s]));
  }

  // Aplica filtros por texto no backend (supplier) via pós-filtro.
  const filteredItems = (itemRows || []).filter((r) => {
    const sname = (r?.suppliers?.name || "").toLowerCase();
    const supplierOk = !suppliers.length || suppliers.some((s) => sname.includes(s));
    return supplierOk;
  });

  // Agregações principais
  let totalSpent = 0;
  let totalQty = 0;
  const purchaseIds = new Set();
  const storesActive = new Set();
  const suppliersActive = new Set();
  const productsActive = new Set();

  const spendByStore = new Map(); // storeId -> spent
  const spendBySupplier = new Map(); // supplierName -> spent
  const spendByMonth = new Map(); // ym -> spent
  const storeMonthSpend = new Map(); // `${storeId}|${ym}` -> spent

  for (const r of filteredItems) {
    const line = Number(r.unit_price || 0) * Number(r.quantity || 0);
    totalSpent += line;
    totalQty += Number(r.quantity || 0);
    if (r.purchase_id) purchaseIds.add(r.purchase_id);
    if (r.store_id) storesActive.add(r.store_id);
    const supplierName = r?.suppliers?.name || "Fornecedor";
    suppliersActive.add(supplierName);
    if (r.product_id) productsActive.add(r.product_id);

    spendByStore.set(r.store_id, (spendByStore.get(r.store_id) || 0) + line);
    spendBySupplier.set(supplierName, (spendBySupplier.get(supplierName) || 0) + line);

    const ym = monthKey(r.purchase_date);
    spendByMonth.set(ym, (spendByMonth.get(ym) || 0) + line);
    storeMonthSpend.set(`${r.store_id}|${ym}`, (storeMonthSpend.get(`${r.store_id}|${ym}`) || 0) + line);
  }

  const purchasesCount = purchaseIds.size;
  const avgTicket = purchasesCount ? totalSpent / purchasesCount : 0;

  // Séries (linha) por loja ao longo dos meses
  const monthLabels = lastNMonthsLabels(Math.max(3, Math.min(12, months)));
  const storesSeries = [...storesActive].map((sid) => {
    const store = storesMap.get(sid);
    const label = store?.name || sid;
    const data = monthLabels.map((ym) => Number(storeMonthSpend.get(`${sid}|${ym}`) || 0));
    return { storeId: sid, storeName: label, data };
  });

  // Donut top fornecedores
  const suppliersTop = [...spendBySupplier.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, spent]) => ({ name, spent }));

  // “Oportunidades” no dashboard: se tiver produto selecionado,
  // calcula desvio por loja comparando média vs menor preço no recorte.
  let opportunitiesTop = [];
  if (productIds.length === 1) {
    const productId = productIds[0];
    const byStore = new Map(); // storeId -> {sum, n}
    for (const r of filteredItems) {
      if (r.product_id !== productId) continue;
      const sid = r.store_id;
      const acc = byStore.get(sid) || { sum: 0, n: 0 };
      acc.sum += Number(r.unit_price || 0);
      acc.n += 1;
      byStore.set(sid, acc);
    }
    const avgRows = [...byStore.entries()].map(([sid, acc]) => ({
      store_id: sid,
      store_name: storesMap.get(sid)?.name || sid,
      store_avg_price: acc.n ? acc.sum / acc.n : 0
    }));
    const best = avgRows.reduce((min, r) => (r.store_avg_price < min ? r.store_avg_price : min), Infinity);
    opportunitiesTop = avgRows
      .map((r) => ({
        store_name: r.store_name,
        product_name: filteredItems.find((x) => x.product_id === productId)?.products?.name || "Produto",
        store_avg_price: r.store_avg_price,
        network_min_price: Number.isFinite(best) ? best : 0,
        above_best_percent: best && Number.isFinite(best) ? ((r.store_avg_price - best) / best) * 100 : 0
      }))
      .sort((a, b) => b.above_best_percent - a.above_best_percent)
      .slice(0, 8);
  }

  // Últimas compras (do recorte)
  const purchasesMap = new Map(); // purchaseId -> {created_at, invoice, storeId, storeName, supplierName, total}
  for (const r of filteredItems) {
    const pid = r.purchase_id;
    if (!pid) continue;
    const p = Array.isArray(r.purchases) ? r.purchases[0] : r.purchases;
    const createdAt = p?.created_at || null;
    const invoice = p?.invoice_number || null;
    const sid = r.store_id;
    const storeName = storesMap.get(sid)?.name || sid;
    const supplierName = r?.suppliers?.name || "Fornecedor";
    const line = Number(r.unit_price || 0) * Number(r.quantity || 0);
    const acc = purchasesMap.get(pid) || {
      purchase_id: pid,
      created_at: createdAt,
      invoice_number: invoice,
      store_id: sid,
      store_name: storeName,
      supplier_name: supplierName,
      total: 0
    };
    acc.total += line;
    // mantém campos mais recentes se vierem nulos
    if (!acc.created_at && createdAt) acc.created_at = createdAt;
    if (!acc.invoice_number && invoice) acc.invoice_number = invoice;
    purchasesMap.set(pid, acc);
  }

  const recentPurchases = [...purchasesMap.values()]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 8);

  return res.json({
    filters: { months, storeIds, productIds, suppliers },
    kpis: {
      totalSpent,
      purchasesCount,
      storesActive: storesActive.size,
      avgTicket,
      suppliersActive: suppliersActive.size,
      productsAnalyzed: productsActive.size,
      totalQty
    },
    series: {
      monthLabels,
      storesSeries,
      suppliersTop
    },
    opportunitiesTop,
    recentPurchases
  });
});

router.get("/alerts/me", requireAuth, async (req, res) => {
  let query = supabaseAdmin
    .from("alerts")
    .select("id, store_id, product_id, type, message, created_at, read_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (!storeIds.length) return res.json([]);
    query = query.in("store_id", storeIds);
  }
  const { data, error } = await query;
  if (error) return res.status(400).json({ message: error.message });

  const seen = new Set();
  const deduped = [];
  for (const row of data || []) {
    const key = `${row.product_id || "none"}-${row.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return res.json(deduped.slice(0, 40));
});

router.get("/admin/comparisons/opportunities", requireAuth, requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("v_admin_price_opportunities")
    .select("*")
    .order("above_best_percent", { ascending: false });
  if (error) return res.status(400).json({ message: error.message });

  const productIds = [...new Set((data || []).map((row) => row.product_id).filter(Boolean))];
  let winnersMap = new Map();
  if (productIds.length) {
    const { data: bestRows, error: bestError } = await supabaseAdmin
      .from("v_product_store_prices")
      .select("product_id,store_id,store_name,unit_price")
      .in("product_id", productIds)
      .order("unit_price", { ascending: true });
    if (bestError) return res.status(400).json({ message: bestError.message });

    for (const row of bestRows || []) {
      if (!winnersMap.has(row.product_id)) {
        winnersMap.set(row.product_id, row);
      }
    }
  }

  const enriched = (data || []).map((row) => {
    const winner = winnersMap.get(row.product_id);
    return {
      ...row,
      best_store_id: winner?.store_id || null,
      best_store_name: winner?.store_name || null,
      best_store_price: winner?.unit_price || row.network_min_price
    };
  });

  return res.json(enriched);
});

router.get("/admin/products/comparison", requireAuth, requireAdmin, async (_req, res) => {
  const [{ data: storeRows, error: storeError }, { data: networkRows, error: networkError }, { data: bestRows, error: bestError }] =
    await Promise.all([
      supabaseAdmin.from("v_store_product_price_stats").select("*"),
      supabaseAdmin.from("v_product_price_stats").select("*"),
      supabaseAdmin.from("v_product_store_prices").select("product_id,store_id,store_name,unit_price").order("unit_price", {
        ascending: true
      })
    ]);

  if (storeError) return res.status(400).json({ message: storeError.message });
  if (networkError) return res.status(400).json({ message: networkError.message });
  if (bestError) return res.status(400).json({ message: bestError.message });

  const networkMap = new Map((networkRows || []).map((row) => [row.product_id, row]));
  const bestMap = new Map();
  for (const row of bestRows || []) {
    if (!bestMap.has(row.product_id)) bestMap.set(row.product_id, row);
  }

  const enriched = (storeRows || []).map((row) => {
    const network = networkMap.get(row.product_id);
    const best = bestMap.get(row.product_id);
    return {
      ...row,
      network_min_price: network?.min_price ?? null,
      network_max_price: network?.max_price ?? null,
      network_avg_price: network?.avg_price ?? null,
      best_store_id: best?.store_id ?? null,
      best_store_name: best?.store_name ?? null,
      best_store_price: best?.unit_price ?? null
    };
  });

  return res.json(enriched);
});

function supplierNameFromRow(row) {
  const s = row?.suppliers;
  if (!s) return "Fornecedor";
  return Array.isArray(s) ? s[0]?.name : s.name;
}

function productFromRow(row) {
  const p = row?.products;
  if (!p) return { name: "Produto", category: "Outros" };
  const o = Array.isArray(p) ? p[0] : p;
  return { name: o?.name || "Produto", category: o?.category || "Outros" };
}

router.get("/manager/overview", requireAuth, async (req, res) => {
  const months = Number(req.query.months ?? 6);
  const productIds = (req.query.productIds || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const supplierIds = (req.query.supplierIds || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cutoff = cutoffDateFromMonths(months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const storeIds = await getManagerStoreIds(req.user);
  if (!storeIds.length) {
    return res.json({
      filters: { months, productIds, supplierIds },
      storeIds: [],
      purchasesCount: 0,
      totalSpent: 0,
      suppliersCount: 0,
      itemsCount: 0,
      avgTicket: 0,
      spendByMonth: [],
      spendBySupplier: [],
      spendByCategory: [],
      spendByWeek: [],
      spendByProduct: [],
      efficiencyScore: null,
      storeCode: null,
      storeName: null,
      ranking: []
    });
  }

  const { data: itemRows, error: itemsError } = await supabaseAdmin
    .from("purchase_items")
    .select(
      "purchase_id, product_id, supplier_id, unit_price, quantity, purchase_date, week_of_month, suppliers ( name ), products ( name, category )"
    )
    .in("store_id", storeIds)
    .gte("purchase_date", cutoffStr);
  if (itemsError) return res.status(400).json({ message: itemsError.message });

  const rows = (itemRows || []).filter((row) => {
    const productOk = !productIds.length || productIds.includes(row.product_id);
    const supplierOk = !supplierIds.length || supplierIds.includes(row.supplier_id);
    return productOk && supplierOk;
  });
  let totalSpent = 0;
  const purchaseIds = new Set();
  const supplierSpend = new Map();
  const categorySpend = new Map();
  const productSpend = new Map();
  const monthSpend = new Map();
  const weekSpend = [0, 0, 0, 0, 0];

  for (const row of rows) {
    const line = Number(row.unit_price) * Number(row.quantity);
    totalSpent += line;
    purchaseIds.add(row.purchase_id);
    const sn = supplierNameFromRow(row);
    supplierSpend.set(sn, (supplierSpend.get(sn) || 0) + line);
    const { name: prodName, category } = productFromRow(row);
    categorySpend.set(category, (categorySpend.get(category) || 0) + line);
    productSpend.set(prodName, (productSpend.get(prodName) || 0) + line);
    const d = new Date(row.purchase_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthSpend.set(key, (monthSpend.get(key) || 0) + line);
    const w = Number(row.week_of_month) || 1;
    if (w >= 1 && w <= 5) weekSpend[w - 1] += line;
  }

  const now = new Date();
  const monthLabels = [];
  const monthsWindow = Math.max(3, Math.min(12, months || 6));
  for (let i = monthsWindow - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const spendByMonth = monthLabels.map((m) => ({ month: m, amount: monthSpend.get(m) || 0 }));

  const spendBySupplier = [...supplierSpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => ({ name, amount }));

  const spendByCategory = [...categorySpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  const spendByProduct = [...productSpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, amount]) => ({ name, amount }));

  const spendByWeek = weekSpend.map((amount, i) => ({ week: i + 1, amount }));

  const uniqueSupplierNames = new Set([...supplierSpend.keys()]);

  const purchasesCount = purchaseIds.size;
  const itemsCount = rows.length;
  const avgTicket = purchasesCount ? totalSpent / purchasesCount : 0;

  const { data: rankingRows } = await supabaseAdmin
    .from("v_store_efficiency_ranking")
    .select("store_id, store_name, efficiency_score")
    .in("store_id", storeIds)
    .order("efficiency_score", { ascending: false });

  const myRank = (rankingRows || []).find((r) => storeIds.includes(r.store_id));
  const efficiencyScore = myRank != null ? Number(myRank.efficiency_score) : null;

  const primaryStoreId =
    req.user?.storeId && storeIds.includes(req.user.storeId) ? req.user.storeId : storeIds[0];

  const { data: primaryStore } = await supabaseAdmin
    .from("stores")
    .select("id, name, store_number")
    .eq("id", primaryStoreId)
    .maybeSingle();

  const storeName = primaryStore?.name ?? myRank?.store_name ?? null;
  const storeCode =
    primaryStore?.store_number != null ? String(primaryStore.store_number) : null;

  return res.json({
    filters: { months, productIds, supplierIds },
    storeIds,
    purchasesCount,
    totalSpent,
    suppliersCount: uniqueSupplierNames.size,
    itemsCount,
    avgTicket,
    spendByMonth,
    spendBySupplier,
    spendByCategory,
    spendByWeek,
    spendByProduct,
    efficiencyScore,
    storeCode,
    storeName,
    ranking: rankingRows || []
  });
});

export default router;
