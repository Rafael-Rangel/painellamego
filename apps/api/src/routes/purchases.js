import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { purchaseItemSchema, purchaseInstallmentSchema, purchaseAdjustmentLineSchema } from "@lamego/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { checkStoreScope, requireAdmin, requireAuth, resolveStoreScope } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";
import { finalizePurchase, deletePurchaseCascade } from "../services/purchaseFinalizeService.js";
import { getPurchaseDetail } from "../services/purchaseDetailService.js";
import { getManagerStoreIds } from "../services/scopeService.js";
import purchaseDraftRoutes from "./purchaseDrafts.js";
import { gatherReceiptFiles, normalizePurchaseDate } from "./purchaseRouteUtils.js";
import { buildReceiptParseContext } from "../services/receiptParseContext.js";
import { parseReceiptWithAI, formatReceiptAiErrorMessage } from "../services/receiptAiService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 }
});
const router = Router();
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

function parseAdjustmentLines(raw) {
  if (raw == null || raw === "") return [];
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const validated = z.array(purchaseAdjustmentLineSchema).safeParse(
    parsed.map((row) => ({
      name: String(row?.name || "").trim(),
      amount: Number(row?.amount) || 0
    }))
  );
  return validated.success ? validated.data : [];
}
const missingStoreIdColumn = (msg = "") =>
  String(msg).toLowerCase().includes("store_id") && String(msg).toLowerCase().includes("suppliers");

function formatZodItemsMessage(zodError) {
  const flat = zodError.flatten();
  const parts = [];
  const labels = {
    productId: "produto",
    supplierId: "fornecedor",
    unitPrice: "preço unitário",
    unitUsed: "unidade",
    quantity: "quantidade",
    purchaseDate: "data da compra",
    weekOfMonth: "semana do mês",
    lineType: "tipo (insumo/venda)"
  };
  for (const [key, msgs] of Object.entries(flat.fieldErrors || {})) {
    const list = Array.isArray(msgs) ? msgs : [msgs];
    for (const m of list) {
      if (m) parts.push(`${labels[key] || key}: ${m}`);
    }
  }
  for (const m of flat.formErrors || []) {
    if (m) parts.push(String(m));
  }
  return parts.length ? parts.join("; ") : "Dados dos itens inválidos.";
}

router.use(purchaseDraftRoutes);

router.post(
  "/receipt-ai-parse",
  requireAuth,
  upload.fields([
    { name: "receipt", maxCount: 1 },
    { name: "receipts", maxCount: 12 }
  ]),
  async (req, res) => {
  const receiptFiles = gatherReceiptFiles(req.files || {});
  if (!receiptFiles.length) return res.status(400).json({ message: "Arquivo da nota é obrigatório." });
  for (const file of receiptFiles) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return res.status(400).json({ message: "Tipo de arquivo não permitido. Use JPG, PNG ou PDF." });
    }
  }

  let suppliersQuery = supabaseAdmin.from("suppliers").select("id,name");
  if (req.user.role !== "admin") {
    const storeIds = await getManagerStoreIds(req.user);
    if (storeIds.length) suppliersQuery = suppliersQuery.in("store_id", storeIds);
  }
  let { data: suppliers, error: suppliersError } = await suppliersQuery;
  if (suppliersError && missingStoreIdColumn(suppliersError.message)) {
    const fallbackSuppliers = await supabaseAdmin.from("suppliers").select("id,name");
    suppliers = fallbackSuppliers.data || [];
  } else if (!suppliers?.length) {
    const fallbackSuppliers = await supabaseAdmin.from("suppliers").select("id,name");
    suppliers = fallbackSuppliers.data || [];
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id,name,normalized_name,category,standard_unit,type,is_active")
    .eq("is_active", true);
  if (productsError) return res.status(400).json({ message: productsError.message });

  let categories = [];
  const { data: catRows, error: catError } = await supabaseAdmin
    .from("categories")
    .select("name")
    .eq("is_active", true)
    .order("name");
  if (!catError && catRows?.length) {
    categories = catRows;
  }

    const reqStarted = Date.now();
    const fileMeta = receiptFiles.map((f) => ({
      name: f.originalname,
      bytes: f.buffer?.length ?? 0,
      mime: f.mimetype
    }));
    console.info("[receipt-ai-parse] início", {
      userId: req.user?.id,
      files: fileMeta,
      totalBytes: fileMeta.reduce((s, f) => s + f.bytes, 0)
    });

    try {
    const supplierIdHint = req.body?.supplierId ? String(req.body.supplierId).trim() : "";
    const supplierIdForParse = supplierIdHint && /^[0-9a-f-]{36}$/i.test(supplierIdHint) ? supplierIdHint : null;

    const ctxStarted = Date.now();
    const sharedParseCtx = await buildReceiptParseContext({
      products: products || [],
      suppliers: suppliers || [],
      categories,
      supplierIdHint: supplierIdForParse,
      documentPageCount: receiptFiles.length
    });
    const ctxMs = Date.now() - ctxStarted;

    const parseStarted = Date.now();
    const aggregate = await parseReceiptWithAI({
      documents: receiptFiles.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })),
      products: products || [],
      suppliers: suppliers || [],
      categories,
      supplierIdHint: supplierIdForParse,
      userId: req.user?.id || null,
      sharedParseCtx,
      deferAliasLearning: true
    });
    const deferredAliasTasks = aggregate._deferredAliasTasks || [];
    delete aggregate._deferredAliasTasks;
    aggregate.missingGlobal = [...new Set(aggregate.missingGlobal || [])];
    console.info("[receipt-ai-parse] ok", {
      userId: req.user?.id,
      ms: Date.now() - reqStarted,
      parseMs: Date.now() - parseStarted,
      ctxMs,
      catalogLines: sharedParseCtx.catalogLines,
      items: aggregate.items.length,
      aliasDeferred: deferredAliasTasks.length
    });
    res.json(aggregate);
    if (deferredAliasTasks.length) {
      void Promise.all(deferredAliasTasks).catch((e) =>
        console.warn("[receipt-ai-parse] alias background", e?.message || e)
      );
    }
    return;
  } catch (err) {
    console.error("[receipt-ai-parse] erro", {
      userId: req.user?.id,
      ms: Date.now() - reqStarted,
      message: err?.message
    });
    return res.status(400).json({ message: formatReceiptAiErrorMessage(err) || "Falha ao analisar nota com IA." });
  }
});

router.post(
  "/",
  requireAuth,
  checkStoreScope,
  resolveStoreScope,
  upload.fields([
    { name: "receipt", maxCount: 1 },
    { name: "receipts", maxCount: 12 }
  ]),
  async (req, res) => {
  let purchaseId = null;
  const contentLength = Number(req.headers["content-length"] || 0);
  try {
    const schema = z.object({
      storeId: z.string().uuid().optional(),
      invoiceNumber: z.string().min(1),
      items: z.string().min(2),
      installments: z.string().optional(),
      taxes: z.string().optional(),
      extras: z.string().optional(),
      notes: z.string().max(2000).optional(),
      documentMetadata: z.string().optional(),
      draftId: z.string().uuid().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msg =
        flat.formErrors?.[0] ||
        Object.values(flat.fieldErrors || {})
          .flat()
          .filter(Boolean)[0] ||
        "Dados do formulário inválidos.";
      return res.status(400).json({ message: msg, details: flat });
    }

    console.info("[purchases] POST início", {
      userId: req.user?.id,
      role: req.user?.role,
      invoiceNumber: String(parsed.data.invoiceNumber || "").slice(0, 40),
      contentLength
    });

    let items = [];
    try {
      items = JSON.parse(parsed.data.items);
    } catch {
      return res.status(400).json({ message: "Formato inválido para itens da compra." });
    }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "Itens da compra são obrigatórios." });
    }

    const itemsParsed = z.array(purchaseItemSchema).safeParse(items);
    if (!itemsParsed.success) {
      return res.status(400).json({
        message: formatZodItemsMessage(itemsParsed.error),
        details: itemsParsed.error.flatten()
      });
    }
    items = itemsParsed.data.map((item) => {
      const purchaseDate = normalizePurchaseDate(item.purchaseDate);
      if (!purchaseDate) {
        return { ...item, purchaseDate: null };
      }
      return { ...item, purchaseDate };
    });
    const badDate = items.find((item) => !item.purchaseDate);
    if (badDate) {
      return res.status(400).json({ message: "Data da compra inválida. Revise a data do lançamento." });
    }

    let installments = [];
    if (parsed.data.installments) {
      try {
        installments = JSON.parse(parsed.data.installments);
      } catch {
        return res.status(400).json({ message: "Formato inválido das parcelas de pagamento." });
      }
      const instParsed = z.array(purchaseInstallmentSchema).safeParse(
        installments.map((row) => ({
          ...row,
          dueDate: normalizePurchaseDate(row.dueDate) || row.dueDate
        }))
      );
      if (!instParsed.success) {
        return res.status(400).json({ message: "Parcelas de pagamento inválidas." });
      }
      installments = instParsed.data;
    }

    const taxes = parseAdjustmentLines(parsed.data.taxes);
    const extras = parseAdjustmentLines(parsed.data.extras);
    const notes = parsed.data.notes ? String(parsed.data.notes).trim() : null;
    let documentMetadata = {};
    if (parsed.data.documentMetadata) {
      try {
        const parsedMeta = JSON.parse(parsed.data.documentMetadata);
        if (parsedMeta && typeof parsedMeta === "object") documentMetadata = parsedMeta;
      } catch {
        return res.status(400).json({ message: "Metadados do documento inválidos." });
      }
    }

    const receiptFiles = gatherReceiptFiles(req.files || {});
    if (!receiptFiles.length) {
      return res.status(400).json({ message: "Arquivo da nota fiscal é obrigatório." });
    }
    for (const file of receiptFiles) {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return res.status(400).json({ message: "Tipo de arquivo não permitido. Use JPG, PNG ou PDF." });
      }
    }

    let storeId = req.storeScopeId;
    if (req.user.role !== "admin") {
      const storeIds = await getManagerStoreIds(req.user);
      storeId = storeIds[0] || req.user.storeId;
    }
    if (!storeId) return res.status(400).json({ message: "Loja não encontrada no escopo do usuário." });

    const result = await finalizePurchase({
      storeId,
      userId: req.user.id,
      invoiceNumber: parsed.data.invoiceNumber,
      items,
      installments,
      receiptFiles,
      draftId: parsed.data.draftId || null,
      taxes,
      extras,
      notes,
      documentMetadata
    });
    purchaseId = result.purchaseId;

    await logAudit({
      userId: req.user.id,
      action: "create",
      resource: "purchase",
      payload: { purchaseId, storeId, items: items.length, draftId: parsed.data.draftId || null }
    });

    console.info("[purchases] POST ok", { userId: req.user?.id, purchaseId, items: items.length });
    return res.status(201).json({ purchaseId, message: "Compra registrada com sucesso." });
  } catch (err) {
    console.error("[purchases] POST falhou", {
      userId: req.user?.id,
      purchaseId,
      contentLength,
      message: err?.message || String(err)
    });
    if (purchaseId) await deletePurchaseCascade(purchaseId);
    const status = err.statusCode || 500;
    const message = err?.message || "Não foi possível registar a compra.";
    return res.status(status).json({ message });
  }
});

/** Detalhe completo de uma compra (admin). */
router.get("/:purchaseId/detail", requireAuth, requireAdmin, async (req, res) => {
  try {
    const detail = await getPurchaseDetail(req.params.purchaseId);
    if (!detail) return res.status(404).json({ message: "Compra não encontrada." });
    return res.json(detail);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Não foi possível carregar a compra." });
  }
});

router.get("/store/:storeId", requireAuth, checkStoreScope, resolveStoreScope, async (req, res) => {
  const storeId = req.storeScopeId;
  if (!storeId) return res.status(400).json({ message: "Loja não encontrada no escopo do usuário." });
  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("*, purchase_items(*, products(name), suppliers(name)), fiscal_receipts(*)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

router.get("/me", requireAuth, async (req, res) => {
  if (req.user.role === "admin") {
    return res.status(400).json({ message: "Use /purchases/store/:storeId para admin." });
  }
  const storeIds = await getManagerStoreIds(req.user);
  if (!storeIds.length) return res.json([]);

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("*, purchase_items(*, products(name), suppliers(name)), fiscal_receipts(*)")
    .in("store_id", storeIds)
    .order("created_at", { ascending: false });
  if (error) return res.status(400).json({ message: error.message });
  return res.json(data);
});

/** Histórico unificado: compras publicadas + rascunhos abertos. */
router.get("/me/ledger", requireAuth, async (req, res) => {
  if (req.user.role === "admin") {
    return res.status(400).json({ message: "Use /purchases/store/:storeId para admin." });
  }
  const storeIds = await getManagerStoreIds(req.user);
  if (!storeIds.length) return res.json([]);

  const [purchasesRes, draftsRes] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("*, purchase_items(*, products(name), suppliers(name)), fiscal_receipts(*)")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("purchase_drafts")
      .select(
        "id, supplier_id, purchase_date, invoice_number, wizard_step, updated_at, items_json, installments_json, taxes_json, extras_json, notes, suppliers(name)"
      )
      .in("store_id", storeIds)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(50)
  ]);

  if (purchasesRes.error) return res.status(400).json({ message: purchasesRes.error.message });
  if (draftsRes.error) return res.status(400).json({ message: draftsRes.error.message });

  const draftIds = (draftsRes.data || []).map((d) => d.id);
  let receiptCount = {};
  if (draftIds.length) {
    const { data: recData } = await supabaseAdmin
      .from("purchase_draft_receipts")
      .select("draft_id")
      .in("draft_id", draftIds);
    for (const r of recData || []) {
      receiptCount[r.draft_id] = (receiptCount[r.draft_id] || 0) + 1;
    }
  }

  const purchases = (purchasesRes.data || []).map((p) => ({
    kind: "published",
    id: p.id,
    date: p.created_at,
    invoiceNumber: p.invoice_number,
    supplierName:
      p.purchase_items?.[0]?.suppliers?.name ||
      (Array.isArray(p.purchase_items?.[0]?.suppliers)
        ? p.purchase_items[0].suppliers[0]?.name
        : null),
    itemCount: p.purchase_items?.length || 0,
    receiptCount: p.fiscal_receipts?.length || 0,
    purchase: p
  }));

  const drafts = (draftsRes.data || []).map((d) => {
    const supplier = Array.isArray(d.suppliers) ? d.suppliers[0] : d.suppliers;
    return {
      kind: "draft",
      id: d.id,
      date: d.updated_at,
      invoiceNumber: d.invoice_number,
      supplierName: supplier?.name || null,
      itemCount: Array.isArray(d.items_json) ? d.items_json.length : 0,
      receiptCount: receiptCount[d.id] || 0,
      purchaseDate: d.purchase_date,
      draft: {
        id: d.id,
        supplierId: d.supplier_id,
        purchaseDate: d.purchase_date,
        invoiceNumber: d.invoice_number,
        wizardStep: d.wizard_step,
        items: d.items_json || [],
        installments: d.installments_json || [],
        taxes: d.taxes_json || [],
        extras: d.extras_json || [],
        notes: d.notes || ""
      }
    };
  });

  const merged = [...drafts, ...purchases].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return res.json(merged);
});

export default router;
