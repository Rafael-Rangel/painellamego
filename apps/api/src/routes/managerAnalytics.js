import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getManagerStoreIds } from "../services/scopeService.js";
import {
  buildManagerFinance,
  buildManagerOverview,
  buildManagerProductDetail,
  buildManagerProductsList,
  buildManagerRankings,
  buildManagerSupplierDetail,
  buildManagerSuppliersList
} from "../services/managerAnalyticsService.js";

const router = Router();

function handleAnalyticsError(res, err) {
  const msg = String(err?.message || err);
  if (msg.includes("Data") || msg.includes("Período") || msg.includes("inválid")) {
    return res.status(400).json({ message: msg });
  }
  return res.status(400).json({ message: msg });
}

async function requireStoreIds(req, res) {
  const storeIds = await getManagerStoreIds(req.user);
  if (!storeIds.length) {
    res.json({ empty: true, storeIds: [] });
    return null;
  }
  return storeIds;
}

router.get("/manager/analytics/overview", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return;
    const data = await buildManagerOverview(storeIds, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

router.get("/manager/analytics/products", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return res.json([]);
    const data = await buildManagerProductsList(storeIds, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

router.get("/manager/analytics/products/:id", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return res.json({ empty: true });
    const data = await buildManagerProductDetail(storeIds, req.params.id, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

router.get("/manager/analytics/suppliers", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return res.json([]);
    const data = await buildManagerSuppliersList(storeIds, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

router.get("/manager/analytics/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return res.json({ empty: true });
    const data = await buildManagerSupplierDetail(storeIds, req.params.id, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

router.get("/manager/analytics/rankings", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return res.json({});
    const data = await buildManagerRankings(storeIds, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

router.get("/manager/analytics/finance", requireAuth, async (req, res) => {
  try {
    const storeIds = await requireStoreIds(req, res);
    if (!storeIds) return res.json({ empty: true, items: [] });
    const data = await buildManagerFinance(storeIds, req.query);
    return res.json(data);
  } catch (e) {
    return handleAnalyticsError(res, e);
  }
});

export default router;
