import { Router } from "express";
import { z } from "zod";
import { normalizeProductNameKey, QUICK_PRODUCT_CATEGORY } from "../lib/productNameNormalize.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";
import { getManagerStoreIds } from "../services/scopeService.js";

const router = Router();
const missingStoreIdColumn = (msg = "") =>
  String(msg).toLowerCase().includes("store_id") && String(msg).toLowerCase().includes("suppliers");

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  type: z.enum(["insumo", "venda"]),
  standardUnit: z.string().min(1)
});

const supplierSchema = z.object({
  name: z.string().min(2),
  storeId: z.string().uuid().optional()
});

function toCategoryCode(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function ensureCategoryExists(categoryName) {
  const name = String(categoryName || "").trim();
  if (!name) return;
  const code = toCategoryCode(name) || `cat-${Date.now()}`;
  const { error } = await supabaseAdmin.from("categories").upsert(
    { code, name, is_active: true },
    { onConflict: "code" }
  );
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    // Compatibilidade com ambientes antigos sem tabela categories.
    if (msg.includes("relation") && msg.includes("categories")) return;
    throw error;
  }
}

router.get("/products", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("products").select("*").order("name");
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

const productQuickSchema = z.object({
  name: z.string().min(2).max(400),
  type: z.enum(["insumo", "venda"]).optional()
});

/** Gerente ou admin: cria produto mínimo em "Outros" ou devolve existente (dedupe por nome normalizado). */
router.post("/products/quick", requireAuth, async (req, res) => {
  const parsed = productQuickSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const displayName = String(parsed.data.name).trim().replace(/\s+/g, " ");
  const keyStrong = normalizeProductNameKey(displayName);
  const keyLegacy = displayName.toLowerCase();
  const lineType = parsed.data.type ?? "insumo";

  const { data: byStrong, error: e1 } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("category", QUICK_PRODUCT_CATEGORY)
    .eq("normalized_name", keyStrong)
    .maybeSingle();
  if (e1) return res.status(400).json({ message: e1.message });
  if (byStrong) return res.status(200).json({ ...byStrong, reused: true });

  const { data: byLegacy, error: e2 } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("category", QUICK_PRODUCT_CATEGORY)
    .eq("normalized_name", keyLegacy)
    .maybeSingle();
  if (e2) return res.status(400).json({ message: e2.message });
  if (byLegacy) return res.status(200).json({ ...byLegacy, reused: true });

  const { data: outrosRows, error: e3 } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("category", QUICK_PRODUCT_CATEGORY)
    .limit(3000);
  if (e3) return res.status(400).json({ message: e3.message });
  const sameKey = (outrosRows || []).find((p) => normalizeProductNameKey(p.name) === keyStrong);
  if (sameKey) return res.status(200).json({ ...sameKey, reused: true });

  await ensureCategoryExists(QUICK_PRODUCT_CATEGORY);
  const catCode = toCategoryCode(QUICK_PRODUCT_CATEGORY);
  const { data: catRow } = await supabaseAdmin.from("categories").select("id").eq("code", catCode).maybeSingle();

  const insertPayload = {
    name: displayName,
    normalized_name: keyStrong,
    category: QUICK_PRODUCT_CATEGORY,
    type: lineType,
    standard_unit: "un",
    is_active: true,
    created_by: req.user?.role === "admin" ? "admin" : "manager"
  };
  if (catRow?.id) insertPayload.category_id = catRow.id;

  const { data: created, error: insErr } = await supabaseAdmin.from("products").insert(insertPayload).select("*").single();
  if (insErr) {
    const msg = String(insErr.message || "");
    if (msg.toLowerCase().includes("unique") || insErr.code === "23505") {
      const { data: again } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("category", QUICK_PRODUCT_CATEGORY)
        .eq("normalized_name", keyStrong)
        .maybeSingle();
      if (again) return res.status(200).json({ ...again, reused: true });
    }
    return res.status(400).json({ message: insErr.message });
  }
  await logAudit({
    userId: req.user.id,
    action: "create",
    resource: "product_quick",
    payload: { productId: created.id }
  });
  return res.status(201).json({ ...created, reused: false });
});

router.get("/categories", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

router.post("/products", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const payload = {
    name: parsed.data.name,
    normalized_name: normalizeProductNameKey(parsed.data.name),
    category: parsed.data.category,
    type: parsed.data.type,
    standard_unit: parsed.data.standardUnit,
    created_by: "admin"
  };
  await ensureCategoryExists(parsed.data.category);
  const { data, error } = await supabaseAdmin.from("products").insert(payload).select("*").single();
  if (error) return res.status(400).json({ message: error.message });
  await logAudit({ userId: req.user.id, action: "create", resource: "product", payload: { productId: data.id } });
  return res.status(201).json(data);
});

router.put("/products/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const payload = {
    name: parsed.data.name,
    normalized_name: normalizeProductNameKey(parsed.data.name),
    category: parsed.data.category,
    type: parsed.data.type,
    standard_unit: parsed.data.standardUnit
  };
  if (error) return res.status(400).json({ message: error.message });
  await logAudit({ userId: req.user.id, action: "update", resource: "product", payload: { productId: data.id } });
  return res.json(data);
});

router.delete("/products/:id", requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ message: error.message });
  await logAudit({ userId: req.user.id, action: "delete", resource: "product", payload: { productId: req.params.id } });
  return res.status(204).send();
});

router.get("/stores", requireAuth, async (req, res) => {
  let query = supabaseAdmin.from("stores").select("*").order("store_number");
  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (!storeIds.length) return res.json([]);
    query = query.in("id", storeIds);
  }
  const { data, error } = await query;
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

router.post("/stores", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    cnpj: z.string().min(14),
    name: z.string().min(2),
    location: z.string().min(2),
    storeNumber: z.number().int().positive(),
    managerName: z.string().min(2)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { data, error } = await supabaseAdmin
    .from("stores")
    .insert({
      cnpj: parsed.data.cnpj,
      name: parsed.data.name,
      location: parsed.data.location,
      store_number: parsed.data.storeNumber,
      manager_name: parsed.data.managerName
    })
    .select("*")
    .single();

  if (error) return res.status(400).json({ message: error.message });
  await logAudit({ userId: req.user.id, action: "create", resource: "store", payload: { storeId: data.id } });
  return res.status(201).json(data);
});

router.put("/stores/:id/onboarding", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    location: z.string().min(2),
    phone: z.string().min(8),
    openingHours: z.string().min(2),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (!storeIds.includes(req.params.id)) {
      return res.status(403).json({ message: "Sem permissão para alterar esta loja." });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("stores")
    .update({
      name: parsed.data.name,
      location: parsed.data.location,
      phone: parsed.data.phone,
      opening_hours: parsed.data.openingHours,
      onboarding_notes: parsed.data.notes ?? null
    })
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) return res.status(400).json({ message: error.message });

  await logAudit({
    userId: req.user.id,
    action: "update",
    resource: "store_onboarding",
    payload: { storeId: req.params.id }
  });
  return res.json(data);
});

router.get("/suppliers", requireAuth, async (req, res) => {
  let query = supabaseAdmin.from("suppliers").select("*").order("name");
  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (!storeIds.length) return res.json([]);
    query = query.in("store_id", storeIds);
  } else if (req.query.storeId) {
    query = query.eq("store_id", req.query.storeId);
  }
  let { data, error } = await query;
  if (error && missingStoreIdColumn(error.message)) {
    ({ data, error } = await supabaseAdmin.from("suppliers").select("*").order("name"));
  }
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

router.post("/suppliers", requireAuth, async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  let supplierStoreId = parsed.data.storeId || null;
  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (!storeIds.length) return res.status(400).json({ message: "Gerente sem loja vinculada." });
    if (supplierStoreId && !storeIds.includes(supplierStoreId)) {
      return res.status(403).json({ message: "Você não pode cadastrar fornecedor para outra loja." });
    }
    supplierStoreId = supplierStoreId || storeIds[0];
  }
  if (!supplierStoreId) {
    return res.status(400).json({ message: "storeId é obrigatório para cadastrar fornecedor." });
  }

  let { data, error } = await supabaseAdmin
    .from("suppliers")
    .insert({ name: parsed.data.name, store_id: supplierStoreId })
    .select("*")
    .single();
  if (error && missingStoreIdColumn(error.message)) {
    ({ data, error } = await supabaseAdmin.from("suppliers").insert({ name: parsed.data.name }).select("*").single());
  }
  if (error) return res.status(400).json({ message: error.message });
  await logAudit({
    userId: req.user.id,
    action: "create",
    resource: "supplier",
    payload: { supplierId: data.id }
  });
  return res.status(201).json(data);
});

export default router;
