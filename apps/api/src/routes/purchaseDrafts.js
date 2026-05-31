import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { purchaseTotalsFromItems } from "@lamego/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, resolveStoreScope } from "../middleware/auth.js";
import { getManagerStoreIds } from "../services/scopeService.js";
import { finalizePurchase } from "../services/purchaseFinalizeService.js";
import { logAudit } from "../services/auditService.js";
import { purchaseItemSchema, purchaseInstallmentSchema, purchaseAdjustmentLineSchema } from "@lamego/shared";
import { gatherReceiptFiles, normalizePurchaseDate } from "./purchaseRouteUtils.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 }
});

const router = Router();
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

async function resolveManagerStoreId(req) {
  if (req.user.role === "admin") return req.storeScopeId || null;
  const storeIds = await getManagerStoreIds(req.user);
  return storeIds[0] || req.user.storeId || null;
}

function parseAdjustmentLines(raw, fallback = []) {
  if (raw == null) return fallback;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  if (!Array.isArray(parsed)) return fallback;
  const validated = z.array(purchaseAdjustmentLineSchema).safeParse(
    parsed.map((row) => ({
      name: String(row?.name || "").trim(),
      amount: Number(row?.amount) || 0
    }))
  );
  return validated.success ? validated.data : fallback;
}

/** Lista rascunhos abertos da loja do gerente. */
router.get("/drafts", requireAuth, async (req, res) => {
  const storeId = await resolveManagerStoreId(req);
  if (!storeId) return res.status(400).json({ message: "Loja não encontrada no escopo do usuário." });

  const { data, error } = await supabaseAdmin
    .from("purchase_drafts")
    .select(
      "id, supplier_id, purchase_date, invoice_number, wizard_step, updated_at, items_json, installments_json, taxes_json, extras_json, suppliers(name)"
    )
    .eq("store_id", storeId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return res.status(400).json({ message: error.message });

  const draftIds = (data || []).map((d) => d.id);
  let receipts = [];
  if (draftIds.length) {
    const { data: recData } = await supabaseAdmin
      .from("purchase_draft_receipts")
      .select("draft_id")
      .in("draft_id", draftIds);
    receipts = recData || [];
  }

  const receiptCount = {};
  for (const r of receipts) {
    receiptCount[r.draft_id] = (receiptCount[r.draft_id] || 0) + 1;
  }

  return res.json(
    (data || []).map((d) => {
      const supplier = Array.isArray(d.suppliers) ? d.suppliers[0] : d.suppliers;
      return {
        id: d.id,
        supplierId: d.supplier_id,
        supplierName: supplier?.name || null,
        purchaseDate: d.purchase_date,
        invoiceNumber: d.invoice_number,
        wizardStep: d.wizard_step,
        updatedAt: d.updated_at,
        itemCount: Array.isArray(d.items_json) ? d.items_json.length : 0,
        receiptCount: receiptCount[d.id] || 0,
        installmentsCount: Array.isArray(d.installments_json) ? d.installments_json.length : 0
      };
    })
  );
});

router.post("/drafts", requireAuth, async (req, res) => {
  const storeId = await resolveManagerStoreId(req);
  if (!storeId) return res.status(400).json({ message: "Loja não encontrada no escopo do usuário." });

  const { data, error } = await supabaseAdmin
    .from("purchase_drafts")
    .insert({
      store_id: storeId,
      created_by: req.user.id,
      status: "open",
      wizard_step: 1
    })
    .select("id")
    .single();

  if (error) return res.status(400).json({ message: error.message });
  return res.status(201).json({ draftId: data.id });
});

router.get("/drafts/:draftId", requireAuth, async (req, res) => {
  const storeId = await resolveManagerStoreId(req);
  if (!storeId) return res.status(400).json({ message: "Loja não encontrada." });

  const { data, error } = await supabaseAdmin
    .from("purchase_drafts")
    .select("*, purchase_draft_receipts(id, original_name, mime_type, created_at)")
    .eq("id", req.params.draftId)
    .eq("store_id", storeId)
    .eq("status", "open")
    .maybeSingle();

  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Rascunho não encontrado ou já finalizado." });

  return res.json({
    id: data.id,
    supplierId: data.supplier_id,
    purchaseDate: data.purchase_date,
    invoiceNumber: data.invoice_number,
    wizardStep: data.wizard_step,
    items: data.items_json || [],
    installments: data.installments_json || [],
    taxes: data.taxes_json || [],
    extras: data.extras_json || [],
    receipts: (data.purchase_draft_receipts || []).map((r) => ({
      id: r.id,
      originalName: r.original_name,
      mimeType: r.mime_type,
      createdAt: r.created_at
    })),
    notes: data.notes,
    documentMetadata: data.document_metadata_json || {}
  });
});

const saveDraftSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  purchaseDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  wizardStep: z.number().int().min(1).max(6).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  installments: z.array(z.record(z.string(), z.unknown())).optional(),
  taxes: z.array(z.record(z.string(), z.unknown())).optional(),
  extras: z.array(z.record(z.string(), z.unknown())).optional(),
  notes: z.string().max(2000).optional(),
  documentMetadata: z.record(z.string(), z.unknown()).optional()
});

router.put("/drafts/:draftId", requireAuth, async (req, res) => {
  const storeId = await resolveManagerStoreId(req);
  if (!storeId) return res.status(400).json({ message: "Loja não encontrada." });

  const parsed = saveDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Dados do rascunho inválidos." });

  const patch = { updated_at: new Date().toISOString() };
  if (parsed.data.supplierId !== undefined) patch.supplier_id = parsed.data.supplierId;
  if (parsed.data.purchaseDate !== undefined) {
    patch.purchase_date = normalizePurchaseDate(parsed.data.purchaseDate);
  }
  if (parsed.data.invoiceNumber !== undefined) patch.invoice_number = parsed.data.invoiceNumber;
  if (parsed.data.wizardStep !== undefined) patch.wizard_step = parsed.data.wizardStep;
  if (parsed.data.items !== undefined) patch.items_json = parsed.data.items;
  if (parsed.data.installments !== undefined) patch.installments_json = parsed.data.installments;
  if (parsed.data.taxes !== undefined) patch.taxes_json = parsed.data.taxes;
  if (parsed.data.extras !== undefined) patch.extras_json = parsed.data.extras;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.documentMetadata !== undefined) patch.document_metadata_json = parsed.data.documentMetadata;

  const { data, error } = await supabaseAdmin
    .from("purchase_drafts")
    .update(patch)
    .eq("id", req.params.draftId)
    .eq("store_id", storeId)
    .eq("status", "open")
    .select("id, updated_at")
    .maybeSingle();

  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Rascunho não encontrado." });
  return res.json({ ok: true, updatedAt: data.updated_at });
});

router.delete("/drafts/:draftId", requireAuth, async (req, res) => {
  const storeId = await resolveManagerStoreId(req);
  const { data: recs } = await supabaseAdmin
    .from("purchase_draft_receipts")
    .select("storage_path")
    .eq("draft_id", req.params.draftId);
  if (recs?.length) {
    await supabaseAdmin.storage.from("fiscal-receipts").remove(recs.map((r) => r.storage_path));
  }
  await supabaseAdmin
    .from("purchase_drafts")
    .update({ status: "discarded" })
    .eq("id", req.params.draftId)
    .eq("store_id", storeId);
  return res.json({ ok: true });
});

router.post(
  "/drafts/:draftId/receipts",
  requireAuth,
  upload.fields([{ name: "receipts", maxCount: 12 }]),
  async (req, res) => {
    const storeId = await resolveManagerStoreId(req);
    const files = gatherReceiptFiles(req.files || {});
    if (!files.length) return res.status(400).json({ message: "Envie pelo menos um ficheiro." });

    const { data: draft } = await supabaseAdmin
      .from("purchase_drafts")
      .select("id")
      .eq("id", req.params.draftId)
      .eq("store_id", storeId)
      .eq("status", "open")
      .maybeSingle();
    if (!draft) return res.status(404).json({ message: "Rascunho não encontrado." });

    const uploaded = [];
    for (const file of files) {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return res.status(400).json({ message: "Use JPG, PNG ou PDF." });
      }
      const safeName = String(file.originalname || "nota").replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
      const filePath = `drafts/${draft.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("fiscal-receipts")
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (upErr) return res.status(400).json({ message: upErr.message });

      const { data: row, error: insErr } = await supabaseAdmin
        .from("purchase_draft_receipts")
        .insert({
          draft_id: draft.id,
          storage_path: filePath,
          original_name: file.originalname,
          mime_type: file.mimetype
        })
        .select("id, original_name")
        .single();
      if (insErr) return res.status(400).json({ message: insErr.message });
      uploaded.push(row);
    }

    await supabaseAdmin
      .from("purchase_drafts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", draft.id);

    return res.status(201).json({ uploaded });
  }
);

router.delete("/drafts/:draftId/receipts/:receiptId", requireAuth, async (req, res) => {
  const storeId = await resolveManagerStoreId(req);
  const { data: row } = await supabaseAdmin
    .from("purchase_draft_receipts")
    .select("id, storage_path, draft_id")
    .eq("id", req.params.receiptId)
    .maybeSingle();
  if (!row) return res.status(404).json({ message: "Anexo não encontrado." });

  const { data: draft } = await supabaseAdmin
    .from("purchase_drafts")
    .select("id")
    .eq("id", row.draft_id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!draft) return res.status(404).json({ message: "Rascunho não encontrado." });

  await supabaseAdmin.storage.from("fiscal-receipts").remove([row.storage_path]);
  await supabaseAdmin.from("purchase_draft_receipts").delete().eq("id", row.id);
  return res.json({ ok: true });
});

router.post(
  "/drafts/:draftId/finalize",
  requireAuth,
  upload.fields([{ name: "receipts", maxCount: 12 }]),
  async (req, res) => {
    const storeId = await resolveManagerStoreId(req);
    if (!storeId) return res.status(400).json({ message: "Loja não encontrada." });

    const { data: draft, error: dErr } = await supabaseAdmin
      .from("purchase_drafts")
      .select("*, purchase_draft_receipts(*)")
      .eq("id", req.params.draftId)
      .eq("store_id", storeId)
      .eq("status", "open")
      .maybeSingle();
    if (dErr) return res.status(400).json({ message: dErr.message });
    if (!draft) return res.status(404).json({ message: "Rascunho não encontrado." });

    const invoiceNumber = String(req.body?.invoiceNumber || draft.invoice_number || "").trim();
    if (!invoiceNumber) {
      return res.status(400).json({ message: "Informe o número da nota fiscal." });
    }

    let items = draft.items_json || [];
    if (req.body?.items) {
      try {
        items = JSON.parse(req.body.items);
      } catch {
        return res.status(400).json({ message: "Formato inválido dos itens." });
      }
    }
    const itemsParsed = z.array(purchaseItemSchema).safeParse(items);
    if (!itemsParsed.success) {
      return res.status(400).json({ message: "Revise os itens antes de finalizar." });
    }
    items = itemsParsed.data.map((item) => ({
      ...item,
      purchaseDate: normalizePurchaseDate(item.purchaseDate) || draft.purchase_date
    }));

    let installments = draft.installments_json || [];
    if (req.body?.installments) {
      try {
        installments = JSON.parse(req.body.installments);
      } catch {
        return res.status(400).json({ message: "Formato inválido das parcelas." });
      }
    }
    const instParsed = z.array(purchaseInstallmentSchema).safeParse(
      installments.map((row) => ({
        ...row,
        dueDate: normalizePurchaseDate(row.dueDate) || row.dueDate
      }))
    );
    if (instParsed.success) installments = instParsed.data;

    const taxes = parseAdjustmentLines(req.body?.taxes, draft.taxes_json || []);
    const extras = parseAdjustmentLines(req.body?.extras, draft.extras_json || []);
    const notes = req.body?.notes != null ? String(req.body.notes) : draft.notes || null;
    let documentMetadata = draft.document_metadata_json || {};
    if (req.body?.documentMetadata) {
      try {
        const parsedMeta = JSON.parse(req.body.documentMetadata);
        if (parsedMeta && typeof parsedMeta === "object") documentMetadata = parsedMeta;
      } catch {
        return res.status(400).json({ message: "Metadados do documento inválidos." });
      }
    }

    const newFiles = gatherReceiptFiles(req.files || {});
    const draftReceiptCount = (draft.purchase_draft_receipts || []).length;
    if (!draftReceiptCount && !newFiles.length) {
      return res.status(400).json({
        message: "Anexe pelo menos uma foto ou PDF da nota (no rascunho ou neste envio)."
      });
    }

    try {
      const receiptBuffers = [...newFiles];
      for (const rec of draft.purchase_draft_receipts || []) {
        const { data: blob, error: dlErr } = await supabaseAdmin.storage
          .from("fiscal-receipts")
          .download(rec.storage_path);
        if (dlErr) continue;
        const buf = Buffer.from(await blob.arrayBuffer());
        receiptBuffers.push({
          buffer: buf,
          mimetype: rec.mime_type,
          originalname: rec.original_name
        });
      }

      const { purchaseId } = await finalizePurchase({
        storeId,
        userId: req.user.id,
        invoiceNumber,
        items,
        installments,
        receiptFiles: receiptBuffers,
        draftId: draft.id,
        taxes,
        extras,
        notes,
        documentMetadata
      });

      await logAudit({
        userId: req.user.id,
        action: "create",
        resource: "purchase",
        payload: { purchaseId, fromDraft: draft.id }
      });

      return res.status(201).json({ purchaseId, message: "Compra registrada com sucesso." });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ message: err.message || "Falha ao finalizar rascunho." });
    }
  }
);

export default router;
