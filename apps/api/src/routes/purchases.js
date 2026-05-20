import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { purchaseItemSchema } from "@lamego/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { checkStoreScope, requireAuth, resolveStoreScope } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";
import { recalculateProductSnapshot } from "../services/comparisonService.js";
import { getManagerStoreIds } from "../services/scopeService.js";
import { parseReceiptWithAI } from "../services/receiptAiService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 }
});
const router = Router();
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
const missingStoreIdColumn = (msg = "") =>
  String(msg).toLowerCase().includes("store_id") && String(msg).toLowerCase().includes("suppliers");

function gatherReceiptFiles(filesObj = {}) {
  const many = Array.isArray(filesObj.receipts) ? filesObj.receipts : [];
  const single = Array.isArray(filesObj.receipt) ? filesObj.receipt : [];
  return [...many, ...single];
}

function normalizePurchaseDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function deletePurchaseCascade(purchaseId) {
  if (!purchaseId) return;
  await supabaseAdmin.from("purchases").delete().eq("id", purchaseId);
}

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
    .select("*")
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
    const aggregate = {
      invoiceNumber: null,
      purchaseDate: null,
      supplierSuggestion: null,
      items: [],
      missingGlobal: [],
      documentTotals: null
    };
    const supplierIdHint = req.body?.supplierId ? String(req.body.supplierId).trim() : "";
    const supplierIdForParse = supplierIdHint && /^[0-9a-f-]{36}$/i.test(supplierIdHint) ? supplierIdHint : null;
    for (const file of receiptFiles) {
      const fileStarted = Date.now();
      const parsed = await parseReceiptWithAI({
        imageBuffer: file.buffer,
        mimeType: file.mimetype,
        products: products || [],
        suppliers: suppliers || [],
        categories,
        supplierIdHint: supplierIdForParse,
        userId: req.user?.id || null
      });
      console.info("[receipt-ai-parse] ficheiro", {
        name: file.originalname,
        bytes: file.buffer?.length ?? 0,
        ms: Date.now() - fileStarted,
        items: parsed.items?.length ?? 0
      });
      if (!aggregate.invoiceNumber && parsed.invoiceNumber) aggregate.invoiceNumber = parsed.invoiceNumber;
      if (!aggregate.purchaseDate && parsed.purchaseDate) aggregate.purchaseDate = parsed.purchaseDate;
      if (!aggregate.supplierSuggestion && parsed.supplierSuggestion) aggregate.supplierSuggestion = parsed.supplierSuggestion;
      aggregate.items.push(...(parsed.items || []));
      aggregate.missingGlobal.push(...(parsed.missingGlobal || []));
      if (!aggregate.documentTotals && parsed.documentTotals) {
        aggregate.documentTotals = parsed.documentTotals;
      }
    }
    aggregate.missingGlobal = [...new Set(aggregate.missingGlobal)];
    console.info("[receipt-ai-parse] ok", {
      userId: req.user?.id,
      ms: Date.now() - reqStarted,
      items: aggregate.items.length
    });
    return res.json(aggregate);
  } catch (err) {
    console.error("[receipt-ai-parse] erro", {
      userId: req.user?.id,
      ms: Date.now() - reqStarted,
      message: err?.message
    });
    return res.status(400).json({ message: err.message || "Falha ao analisar nota com IA." });
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
  try {
    const schema = z.object({
      storeId: z.string().uuid().optional(),
      invoiceNumber: z.string().min(1),
      items: z.string().min(2)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

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
      return res.status(400).json({ message: "Dados dos itens inválidos.", details: itemsParsed.error.flatten() });
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

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        store_id: storeId,
        invoice_number: parsed.data.invoiceNumber.trim(),
        created_by: req.user.id
      })
      .select("*")
      .single();
    if (purchaseError) {
      const msg = String(purchaseError.message || "");
      if (msg.toLowerCase().includes("unique_invoice_per_store") || msg.toLowerCase().includes("duplicate")) {
        return res.status(400).json({ message: "Já existe uma compra com este número de nota nesta loja." });
      }
      return res.status(400).json({ message: purchaseError.message });
    }
    purchaseId = purchase.id;

    const payloadItems = items.map((item) => ({
      purchase_id: purchase.id,
      store_id: storeId,
      product_id: item.productId,
      supplier_id: item.supplierId,
      unit_price: item.unitPrice,
      unit_used: item.unitUsed,
      quantity: item.quantity,
      purchase_date: item.purchaseDate,
      week_of_month: item.weekOfMonth,
      line_type: item.lineType
    }));

    const { error: itemsError } = await supabaseAdmin.from("purchase_items").insert(payloadItems);
    if (itemsError) {
      await deletePurchaseCascade(purchaseId);
      purchaseId = null;
      return res.status(400).json({ message: itemsError.message });
    }

    for (const file of receiptFiles) {
      const safeName = String(file.originalname || "nota").replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
      const filePath = `${purchase.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("fiscal-receipts")
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (uploadError) {
        await deletePurchaseCascade(purchaseId);
        purchaseId = null;
        return res.status(400).json({ message: uploadError.message });
      }
      const { error: receiptRowError } = await supabaseAdmin.from("fiscal_receipts").insert({
        purchase_id: purchase.id,
        storage_path: filePath,
        original_name: file.originalname,
        mime_type: file.mimetype
      });
      if (receiptRowError) {
        await supabaseAdmin.storage.from("fiscal-receipts").remove([filePath]);
        await deletePurchaseCascade(purchaseId);
        purchaseId = null;
        return res.status(400).json({ message: receiptRowError.message });
      }
    }

    const productIds = [...new Set(payloadItems.map((row) => row.product_id))];
    for (const pid of productIds) {
      const snap = await recalculateProductSnapshot(pid);
      if (!snap.ok) {
        console.warn("[purchases] snapshot ignorado", { purchaseId: purchase.id, productId: pid, error: snap.error });
      }
    }

    await logAudit({
      userId: req.user.id,
      action: "create",
      resource: "purchase",
      payload: { purchaseId: purchase.id, storeId, items: payloadItems.length }
    });

    return res.status(201).json({ purchaseId: purchase.id, message: "Compra registrada com sucesso." });
  } catch (err) {
    console.error("[purchases] POST falhou", {
      userId: req.user?.id,
      purchaseId,
      message: err?.message || String(err)
    });
    if (purchaseId) await deletePurchaseCascade(purchaseId);
    const message = err?.message || "Não foi possível registar a compra.";
    return res.status(500).json({ message });
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

export default router;
