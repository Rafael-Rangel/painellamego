import { supabaseAdmin } from "../lib/supabase.js";
import { parseAnalyticsDateRange, parseIdList } from "./analyticsDateRange.js";

function lineAmount(row) {
  return Number(row.unit_price || 0) * Number(row.quantity || 0);
}

function weightedAvg(rows) {
  let sumPq = 0;
  let sumQ = 0;
  for (const r of rows) {
    const q = Number(r.quantity || 0);
    if (q <= 0) continue;
    sumPq += Number(r.unit_price || 0) * q;
    sumQ += q;
  }
  return sumQ ? sumPq / sumQ : 0;
}

function supplierNameFromRow(row) {
  const s = row?.suppliers;
  if (!s) return "Fornecedor";
  return Array.isArray(s) ? s[0]?.name : s.name;
}

function productFromRow(row) {
  const p = row?.products;
  if (!p) return { name: "Produto", category: "Outros", standard_unit: "", sale_price: null };
  const o = Array.isArray(p) ? p[0] : p;
  return {
    name: o?.name || "Produto",
    category: o?.category || "Outros",
    standard_unit: o?.standard_unit || "",
    sale_price: o?.sale_price != null ? Number(o.sale_price) : null
  };
}

function priceDelta(prev, curr) {
  if (!prev || !curr) return { deltaAmount: 0, deltaPercent: 0, direction: "flat" };
  const deltaAmount = curr - prev;
  const deltaPercent = prev ? (deltaAmount / prev) * 100 : 0;
  let direction = "flat";
  if (deltaAmount > 0.0001) direction = "up";
  else if (deltaAmount < -0.0001) direction = "down";
  return { deltaAmount, deltaPercent, direction };
}

export async function loadManagerPurchaseItems(storeIds, query) {
  const range = parseAnalyticsDateRange(query);
  const productIds = parseIdList(query.productIds);
  const supplierIds = parseIdList(query.supplierIds);
  const lineType = query.lineType ? String(query.lineType) : null;

  let q = supabaseAdmin
    .from("purchase_items")
    .select(
      "id, purchase_id, product_id, supplier_id, unit_price, quantity, purchase_date, week_of_month, line_type, is_bonification_only, suppliers ( name ), products ( name, category, standard_unit, sale_price )"
    )
    .in("store_id", storeIds)
    .gte("purchase_date", range.fromStr)
    .lte("purchase_date", range.toStr)
    .order("purchase_date", { ascending: true });

  if (productIds.length) q = q.in("product_id", productIds);
  if (supplierIds.length) q = q.in("supplier_id", supplierIds);
  if (lineType) q = q.eq("line_type", lineType);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data || []).filter((r) => !r.is_bonification_only);
  return { rows, range, productIds, supplierIds };
}

function splitPeriodRows(rows, range) {
  const mid = new Date((range.from.getTime() + range.to.getTime()) / 2);
  const midStr = mid.toISOString().slice(0, 10);
  const first = rows.filter((r) => r.purchase_date < midStr);
  const second = rows.filter((r) => r.purchase_date >= midStr);
  return { first, second };
}

function aggregateByProduct(rows) {
  const map = new Map();
  for (const row of rows) {
    const pid = row.product_id;
    const acc = map.get(pid) || {
      productId: pid,
      productName: productFromRow(row).name,
      standardUnit: productFromRow(row).standard_unit,
      category: productFromRow(row).category,
      salePrice: productFromRow(row).sale_price,
      rows: [],
      totalQty: 0,
      totalSpent: 0,
      minPrice: Infinity,
      maxPrice: 0
    };
    acc.rows.push(row);
    acc.totalQty += Number(row.quantity || 0);
    const spent = lineAmount(row);
    acc.totalSpent += spent;
    const p = Number(row.unit_price || 0);
    if (p < acc.minPrice) acc.minPrice = p;
    if (p > acc.maxPrice) acc.maxPrice = p;
    map.set(pid, acc);
  }
  for (const acc of map.values()) {
    acc.avgPrice = weightedAvg(acc.rows);
    if (!Number.isFinite(acc.minPrice)) acc.minPrice = 0;
    const sorted = [...acc.rows].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
    const last = sorted[sorted.length - 1];
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    acc.lastPrice = last ? Number(last.unit_price) : 0;
    acc.previousPrice = prev ? Number(prev.unit_price) : null;
    const d = priceDelta(acc.previousPrice, acc.lastPrice);
    acc.deltaAmount = d.deltaAmount;
    acc.deltaPercent = d.deltaPercent;
    acc.priceDirection = d.direction;
  }
  return map;
}

function seriesFromRows(rows, range) {
  const labels = range.buildLabels();
  const spendMap = new Map(labels.map((l) => [l, 0]));
  const qtyMap = new Map(labels.map((l) => [l, 0]));
  for (const row of rows) {
    const key = range.bucketKey(row.purchase_date);
    if (!spendMap.has(key)) continue;
    spendMap.set(key, (spendMap.get(key) || 0) + lineAmount(row));
    qtyMap.set(key, (qtyMap.get(key) || 0) + Number(row.quantity || 0));
  }
  return {
    spendByBucket: labels.map((label) => ({ label, amount: spendMap.get(label) || 0 })),
    qtyByBucket: labels.map((label) => ({ label, quantity: qtyMap.get(label) || 0 }))
  };
}

export async function buildManagerOverview(storeIds, query) {
  const { rows, range } = await loadManagerPurchaseItems(storeIds, query);
  const purchaseIds = new Set();
  let totalSpent = 0;
  let totalQty = 0;
  const supplierNames = new Set();

  for (const row of rows) {
    totalSpent += lineAmount(row);
    totalQty += Number(row.quantity || 0);
    purchaseIds.add(row.purchase_id);
    supplierNames.add(supplierNameFromRow(row));
  }

  const { spendByBucket, qtyByBucket } = seriesFromRows(rows, range);
  const byProduct = aggregateByProduct(rows);
  const productList = [...byProduct.values()].sort((a, b) => b.totalSpent - a.totalSpent);

  const categorySpend = new Map();
  for (const row of rows) {
    const { category } = productFromRow(row);
    categorySpend.set(category, (categorySpend.get(category) || 0) + lineAmount(row));
  }

  const weekSpend = [0, 0, 0, 0, 0];
  for (const row of rows) {
    const w = Number(row.week_of_month) || 1;
    if (w >= 1 && w <= 5) weekSpend[w - 1] += lineAmount(row);
  }

  const { first, second } = splitPeriodRows(rows, range);
  const avgFirst = weightedAvg(first);
  const avgSecond = weightedAvg(second);
  const periodPriceChange = priceDelta(avgFirst, avgSecond);

  const { data: rankingRows } = await supabaseAdmin
    .from("v_store_efficiency_ranking")
    .select("store_id, store_name, efficiency_score")
    .in("store_id", storeIds)
    .order("efficiency_score", { ascending: false });

  const myRank = (rankingRows || []).find((r) => storeIds.includes(r.store_id));

  return {
    filters: {
      dateFrom: range.fromStr,
      dateTo: range.toStr,
      granularity: range.granularity,
      preset: range.preset
    },
    totalSpent,
    totalQty,
    purchasesCount: purchaseIds.size,
    itemsCount: rows.length,
    suppliersCount: supplierNames.size,
    avgTicket: purchaseIds.size ? totalSpent / purchaseIds.size : 0,
    avgPriceChangePercent: periodPriceChange.deltaPercent,
    priceChangeDirection: periodPriceChange.direction,
    spendByBucket,
    qtyByBucket,
    spendByCategory: [...categorySpend.entries()].map(([category, amount]) => ({ category, amount })),
    spendByWeek: weekSpend.map((amount, i) => ({ week: i + 1, amount })),
    topProductsBySpend: productList.slice(0, 8).map((p) => ({
      productId: p.productId,
      name: p.productName,
      amount: p.totalSpent,
      quantity: p.totalQty
    })),
    topProductsByQty: [...productList]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 8)
      .map((p) => ({
        productId: p.productId,
        name: p.productName,
        quantity: p.totalQty,
        amount: p.totalSpent
      })),
    efficiencyScore: myRank != null ? Number(myRank.efficiency_score) : null,
    storeName: myRank?.store_name ?? null,
    ranking: rankingRows || []
  };
}

export async function buildManagerProductsList(storeIds, query) {
  const { rows, range } = await loadManagerPurchaseItems(storeIds, query);
  const { first, second } = splitPeriodRows(rows, range);
  const firstByProduct = aggregateByProduct(first);
  const byProduct = aggregateByProduct(rows);

  return [...byProduct.values()]
    .map((p) => {
      const prev = firstByProduct.get(p.productId);
      const prevAvg = prev ? weightedAvg(prev.rows) : weightedAvg(second.filter((r) => r.product_id === p.productId));
      const periodDelta = priceDelta(prevAvg || p.avgPrice, p.avgPrice);
      return {
        productId: p.productId,
        name: p.productName,
        standardUnit: p.standardUnit,
        category: p.category,
        totalQty: p.totalQty,
        totalSpent: p.totalSpent,
        minPrice: p.minPrice,
        maxPrice: p.maxPrice,
        avgPrice: p.avgPrice,
        lastPrice: p.lastPrice,
        previousPrice: p.previousPrice,
        deltaAmount: p.deltaAmount,
        deltaPercent: p.deltaPercent,
        priceDirection: p.priceDirection,
        periodDeltaPercent: periodDelta.deltaPercent,
        periodPriceDirection: periodDelta.direction
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function buildManagerProductDetail(storeIds, productId, query) {
  const q = { ...query, productIds: productId };
  const { rows, range } = await loadManagerPurchaseItems(storeIds, q);
  const productRows = rows.filter((r) => r.product_id === productId);
  if (!productRows.length) {
    return { productId, empty: true };
  }

  const p = aggregateByProduct(productRows).get(productId);
  const { spendByBucket, qtyByBucket } = seriesFromRows(productRows, range);

  const pricePoints = productRows.map((r) => ({
    date: r.purchase_date,
    unitPrice: Number(r.unit_price),
    quantity: Number(r.quantity),
    supplierName: supplierNameFromRow(r)
  }));

  return {
    productId,
    name: p.productName,
    standardUnit: p.standardUnit,
    category: p.category,
    salePrice: p.salePrice,
    totalQty: p.totalQty,
    totalSpent: p.totalSpent,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    avgPrice: p.avgPrice,
    lastPrice: p.lastPrice,
    previousPrice: p.previousPrice,
    deltaAmount: p.deltaAmount,
    deltaPercent: p.deltaPercent,
    priceDirection: p.priceDirection,
    spendByBucket,
    qtyByBucket,
    pricePoints,
    filters: {
      dateFrom: range.fromStr,
      dateTo: range.toStr,
      granularity: range.granularity
    }
  };
}

function aggregateBySupplier(rows) {
  const map = new Map();
  for (const row of rows) {
    const sid = row.supplier_id;
    const acc = map.get(sid) || {
      supplierId: sid,
      supplierName: supplierNameFromRow(row),
      rows: [],
      productIds: new Set(),
      totalQty: 0,
      totalSpent: 0
    };
    acc.rows.push(row);
    acc.productIds.add(row.product_id);
    acc.totalQty += Number(row.quantity || 0);
    acc.totalSpent += lineAmount(row);
    map.set(sid, acc);
  }
  for (const acc of map.values()) {
    acc.avgPrice = weightedAvg(acc.rows);
    acc.productCount = acc.productIds.size;
    delete acc.rows;
    delete acc.productIds;
  }
  return map;
}

export async function buildManagerSuppliersList(storeIds, query) {
  const { rows } = await loadManagerPurchaseItems(storeIds, query);
  return [...aggregateBySupplier(rows).values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function buildManagerSupplierDetail(storeIds, supplierId, query) {
  const q = { ...query, supplierIds: supplierId };
  const { rows, range } = await loadManagerPurchaseItems(storeIds, q);
  const supplierRows = rows.filter((r) => r.supplier_id === supplierId);
  if (!supplierRows.length) return { supplierId, empty: true };

  const byProduct = aggregateByProduct(supplierRows);
  const supplierName = supplierNameFromRow(supplierRows[0]);
  let totalSpent = 0;
  let totalQty = 0;
  for (const row of supplierRows) {
    totalSpent += lineAmount(row);
    totalQty += Number(row.quantity || 0);
  }

  return {
    supplierId,
    supplierName,
    totalSpent,
    totalQty,
    productCount: byProduct.size,
    avgPrice: weightedAvg(supplierRows),
    products: [...byProduct.values()]
      .map((p) => ({
        productId: p.productId,
        name: p.productName,
        standardUnit: p.standardUnit,
        totalQty: p.totalQty,
        totalSpent: p.totalSpent,
        minPrice: p.minPrice,
        maxPrice: p.maxPrice,
        avgPrice: p.avgPrice
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent),
    filters: { dateFrom: range.fromStr, dateTo: range.toStr }
  };
}

export async function buildManagerRankings(storeIds, query) {
  const products = await buildManagerProductsList(storeIds, query);
  const suppliers = await buildManagerSuppliersList(storeIds, query);

  return {
    topPriceIncrease: [...products]
      .filter((p) => p.periodDeltaPercent > 0)
      .sort((a, b) => b.periodDeltaPercent - a.periodDeltaPercent)
      .slice(0, 10),
    topSpend: products.slice(0, 10),
    topQty: [...products].sort((a, b) => b.totalQty - a.totalQty).slice(0, 10),
    mostExpensive: [...products].sort((a, b) => b.avgPrice - a.avgPrice).slice(0, 10),
    topSuppliers: suppliers.slice(0, 10),
    cheapestSuppliers: [...suppliers].sort((a, b) => a.avgPrice - b.avgPrice).slice(0, 10)
  };
}

export async function buildManagerFinance(storeIds, query) {
  const { rows, range } = await loadManagerPurchaseItems(storeIds, query);
  const { first, second } = splitPeriodRows(rows, range);
  const byProduct = aggregateByProduct(rows);
  const firstByProduct = aggregateByProduct(first);

  let totalInflationImpact = 0;
  const items = [];

  for (const p of byProduct.values()) {
    const prevRows = firstByProduct.get(p.productId)?.rows || [];
    const prevAvg = prevRows.length ? weightedAvg(prevRows) : p.avgPrice;
    const impact = (p.avgPrice - prevAvg) * p.totalQty;
    if (impact > 0) totalInflationImpact += impact;

    let marginPercent = null;
    if (p.salePrice != null && p.salePrice > 0) {
      marginPercent = ((p.salePrice - p.avgPrice) / p.salePrice) * 100;
    }

    items.push({
      productId: p.productId,
      name: p.productName,
      standardUnit: p.standardUnit,
      salePrice: p.salePrice,
      avgPurchasePrice: p.avgPrice,
      marginPercent,
      priceImpact: impact,
      totalQty: p.totalQty,
      totalSpent: p.totalSpent,
      deltaPercent: p.deltaPercent,
      priceDirection: p.priceDirection
    });
  }

  items.sort((a, b) => Math.abs(b.priceImpact) - Math.abs(a.priceImpact));

  const withMargin = items.filter((i) => i.marginPercent != null);
  const negativeMargin = withMargin.filter((i) => i.marginPercent < 0);

  return {
    filters: { dateFrom: range.fromStr, dateTo: range.toStr },
    totalInflationImpact,
    productsWithSalePrice: withMargin.length,
    productsTotal: items.length,
    salePriceCoveragePercent: items.length ? (withMargin.length / items.length) * 100 : 0,
    negativeMarginCount: negativeMargin.length,
    criticalProducts: negativeMargin.slice(0, 15),
    items: items.slice(0, 50)
  };
}
