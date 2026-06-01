import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, withAuth } from "../api";
import { buildUnitOptions, normalizeUnitUsed } from "../lib/catalogUnits";
import {
  compressReceiptFilesForAi,
  compressReceiptFilesForSubmit,
  formatFileSize,
  warmReceiptCompressCache
} from "../lib/compressReceiptImages";
import { catalogMessageFromApiError, catalogUserMessage, logCatalog } from "../lib/catalogFeedback";
import { purchaseApiErrorMessage } from "../lib/purchaseErrors";
import {
  isBonificationOnlyLine,
  parseBrNumber,
  purchaseInvoiceSummary,
  purchaseTotalsFromItems,
  purchaseTotalsWithDraft,
  validateInstallmentsAgainstPayable
} from "../lib/purchaseTotals";
import { MAX_RECEIPT_FILES, mergeUniqueReceiptFiles, receiptFileKey } from "../lib/receiptFiles";
import {
  EMPTY_DOCUMENT_METADATA,
  confidenceClass,
  mapApiAdjustmentLines,
  mapApiInstallments,
  mapApiMetadataToForm,
  needsReview,
  serializeDocumentMetadata
} from "../lib/aiFieldConfidence";
import { receiptAiUserFacingMessage } from "../lib/receiptAiUserMessages.js";

export { MAX_RECEIPT_FILES };

const AI_REQUEST_TIMEOUT_MS = 120_000;
const AI_MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAiError(err) {
  const st = err?.response?.status;
  return err?.code === "ECONNABORTED" || st === 502 || st === 503 || st === 504;
}

export function toWeekOfMonth(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 1;
  return Math.min(5, Math.max(1, Math.ceil(date.getDate() / 7)));
}

/** Data enviada à API (coluna `date` no Postgres). */
export function toPurchaseDatePayload(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Normaliza número da NF vindo da IA (pode ser número ou string). */
export function invoiceNumberFromAi(value) {
  if (value == null) return "";
  const s = String(value).trim();
  return s || "";
}

export function resolveItemCategory(row, productList) {
  const explicit = String(row?.category || "").trim();
  if (explicit.length >= 2) return explicit;
  if (row?.productId) {
    const p = (productList || []).find((x) => x.id === row.productId);
    const fromProduct = String(p?.category || "").trim();
    if (fromProduct.length >= 2) return fromProduct;
  }
  return "";
}

const EMPTY_DRAFT_ITEM = {
  productId: "",
  category: "",
  quantity: "",
  unitUsed: "kg",
  unitPrice: "",
  lineType: "insumo",
  isBonificationOnly: false,
  bonusQuantity: "",
  bonusUnitValue: "",
  notes: ""
};

export function serializeAdjustmentLines(lines = []) {
  return (lines || [])
    .map((row) => ({
      name: String(row?.name || "").trim(),
      amount: parseBrNumber(row?.amount) || 0
    }))
    .filter((row) => row.name.length > 0);
}

export function buildItemRowFromAi(it, { singleLineInvoice, allowedUnits }) {
  const priceNum = it.unitPrice != null ? Number(it.unitPrice) : NaN;
  if (!it.productId || !Number.isFinite(priceNum) || priceNum <= 0) return null;
  let qty = it.quantity != null ? Number(it.quantity) : NaN;
  if (!Number.isFinite(qty) || qty <= 0) {
    if (singleLineInvoice) qty = 1;
    else return null;
  }
  return {
    productId: it.productId,
    category: String(it.category || it.categoryHint || "").trim(),
    quantity: String(qty),
    unitUsed: normalizeUnitUsed(it.unitUsed, allowedUnits),
    unitPrice: String(priceNum),
    lineType: it.lineType === "venda" ? "venda" : "insumo",
    aiLineTotal: Number.isFinite(Number(it.lineTotal)) ? Number(it.lineTotal) : undefined,
    notes: it.notes ? String(it.notes) : "",
    notesConfidence: it.notesConfidence || null
  };
}

/** Linha na lista mesmo sem produto no catálogo — pré-preenche nome lido na NF. */
export function buildItemRowFromAiPartial(it, { singleLineInvoice, allowedUnits }) {
  const raw = String(it.rawProductName || it.extractedProductName || it.productName || "").trim();
  if (!it.productId && raw.length < 2) return null;

  let qty = it.quantity != null ? Number(it.quantity) : NaN;
  let priceNum = it.unitPrice != null ? Number(it.unitPrice) : NaN;
  const lineTotalNum = it.lineTotal != null ? Number(it.lineTotal) : NaN;

  if ((!Number.isFinite(priceNum) || priceNum <= 0) && Number.isFinite(lineTotalNum) && lineTotalNum > 0) {
    if (Number.isFinite(qty) && qty > 0) priceNum = lineTotalNum / qty;
    else if (singleLineInvoice) {
      qty = 1;
      priceNum = lineTotalNum;
    }
  }
  if ((!Number.isFinite(qty) || qty <= 0) && Number.isFinite(priceNum) && priceNum > 0) {
    qty = 1;
  }
  if (
    (!Number.isFinite(priceNum) || priceNum <= 0) &&
    Number.isFinite(qty) &&
    qty > 0 &&
    Number.isFinite(lineTotalNum) &&
    lineTotalNum > 0
  ) {
    priceNum = lineTotalNum / qty;
  }

  const hasAnyValue =
    (Number.isFinite(qty) && qty > 0) ||
    (Number.isFinite(priceNum) && priceNum > 0) ||
    (Number.isFinite(lineTotalNum) && lineTotalNum > 0);
  if (!it.productId && !hasAnyValue && raw.length < 2) return null;

  return {
    productId: it.productId || "",
    category: String(it.category || it.categoryHint || "").trim(),
    aiRawProductName: it.productId ? undefined : raw || undefined,
    quantity: Number.isFinite(qty) && qty > 0 ? String(qty) : "",
    unitUsed: normalizeUnitUsed(it.unitUsed, allowedUnits),
    unitPrice: Number.isFinite(priceNum) && priceNum > 0 ? String(priceNum) : "",
    lineType: it.lineType === "venda" ? "venda" : "insumo",
    aiLineTotal: Number.isFinite(lineTotalNum) && lineTotalNum > 0 ? lineTotalNum : undefined,
    notes: it.notes ? String(it.notes) : "",
    notesConfidence: it.notesConfidence || null
  };
}

/**
 * Estado e ações partilhadas entre o wizard de compra e a página “Compra com IA”.
 * @param {string} token
 * @param {{ recordAiHighlights?: boolean, onAfterConfirm?: () => void }} options
 */
export function usePurchaseForm(token, options = {}) {
  const { recordAiHighlights = false, onAfterConfirm } = options;

  const [overview, setOverview] = useState(undefined);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catalogUnits, setCatalogUnits] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receipts, setReceipts] = useState([]);
  /** Anexos adicionais só no envio final (não disparam nova leitura por IA). Usado na página Compra com IA. */
  const [receiptExtras, setReceiptExtras] = useState([]);
  const [items, setItems] = useState([]);
  const [draftItem, setDraftItem] = useState({ ...EMPTY_DRAFT_ITEM });
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [extras, setExtras] = useState([]);
  const [notes, setNotes] = useState("");
  const [toast, setToastState] = useState("");
  const [toastType, setToastType] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiRetryCount, setAiRetryCount] = useState(0);
  const [aiMissing, setAiMissing] = useState([]);
  const [documentTotals, setDocumentTotals] = useState(null);
  const [documentMetadata, setDocumentMetadata] = useState(() => ({ ...EMPTY_DOCUMENT_METADATA }));
  const [aiFieldConfidence, setAiFieldConfidence] = useState({});
  const analyzeProgressTimerRef = useRef(null);
  const [aiHighlightKeys, setAiHighlightKeys] = useState(() => new Set());
  const [supplierCreating, setSupplierCreating] = useState(false);
  const [productCreating, setProductCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const setToast = useCallback((message, type = null) => {
    setToastState(message || "");
    setToastType(message ? type : null);
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get("/catalog/suppliers", withAuth(token)),
      api.get("/catalog/products", withAuth(token)),
      api.get("/catalog/categories", withAuth(token)),
      api.get("/catalog/units", withAuth(token)),
      api.get("/manager/overview", withAuth(token))
    ]).then(([supRes, prodRes, catRes, unitsRes, ovRes]) => {
      setSuppliers(supRes.data?.length ? supRes.data : []);
      setProducts(prodRes.data?.length ? prodRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setCatalogUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
      setOverview(ovRes.data ?? null);
    });
  }, [token]);

  const unitOptions = useMemo(() => buildUnitOptions(catalogUnits, products), [catalogUnits, products]);

  const categoryOptions = useMemo(() => {
    const fromTable = (categories || []).map((c) => c.name).filter(Boolean);
    const fromProducts = (products || []).map((p) => p.category).filter(Boolean);
    return [...new Set([...fromTable, ...fromProducts])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, products]);

  const pickDraftProduct = useCallback(
    (productId) => {
      const product = products.find((p) => p.id === productId);
      setDraftItem((d) => {
        const lineType = product?.type === "venda" ? "venda" : "insumo";
        const unitUsed = product?.standard_unit ? normalizeUnitUsed(product.standard_unit, unitOptions) : d.unitUsed;
        const category = product?.category ? String(product.category) : d.category;
        return { ...d, productId, lineType, unitUsed, category, aiRawProductName: undefined };
      });
    },
    [products, unitOptions]
  );

  const total = useMemo(
    () => purchaseTotalsWithDraft(items, draftItem, editingItemIndex).totalPayable,
    [items, draftItem, editingItemIndex]
  );

  const invoiceSummary = useMemo(
    () => purchaseInvoiceSummary(items, taxes, extras),
    [items, taxes, extras]
  );

  const canConfirmPurchase = useMemo(() => {
    if (aiLoading || confirming) return false;
    if (!supplierId || !receipts.length || !items.length) return false;
    return items.every((it) => {
      const hasProduct = Boolean(it.productId) || String(it.aiRawProductName || "").trim().length >= 2;
      const category = resolveItemCategory(it, products);
      const qty = parseBrNumber(it.quantity);
      const price = parseBrNumber(it.unitPrice);
      return (
        hasProduct &&
        Boolean(category) &&
        Number.isFinite(qty) &&
        qty > 0 &&
        Number.isFinite(price) &&
        price > 0 &&
        String(it.unitUsed || "").trim().length > 0
      );
    });
  }, [aiLoading, confirming, supplierId, receipts.length, items, products]);

  const addItem = useCallback(() => {
    const d = draftItem;
    const category = resolveItemCategory(d, products);
    const qty = parseBrNumber(d.quantity);
    const price = parseBrNumber(d.unitPrice);
    const bonusQty = parseBrNumber(d.bonusQuantity) || 0;
    const bonusVal = parseBrNumber(d.bonusUnitValue) || 0;

    const rawName = String(d.aiRawProductName || "").trim();
    if (!d.productId && rawName.length < 2) {
      setToast("Selecione o produto na lista ou mantenha o nome lido da nota.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (isBonificationOnlyLine(d)) {
      if (bonusQty <= 0 && qty <= 0) {
        setToast("Informe a quantidade do produto de bonificação.");
        setTimeout(() => setToast(""), 3200);
        return;
      }
    } else {
      if (!Number.isFinite(qty) || qty <= 0) {
        setToast("Informe a quantidade comprada.");
        setTimeout(() => setToast(""), 3200);
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        setToast("Informe o valor unitário.");
        setTimeout(() => setToast(""), 3200);
        return;
      }
    }
    if (!category) {
      setToast("Informe a categoria do item.");
      setTimeout(() => setToast(""), 3200);
      return;
    }

    const bonusOnly = d.isBonificationOnly === true;
    const newRow = {
      productId: d.productId || "",
      aiRawProductName: d.productId ? undefined : rawName || undefined,
      category,
      lineType: d.lineType === "venda" ? "venda" : "insumo",
      isBonificationOnly: bonusOnly,
      quantity: bonusOnly ? String(bonusQty || qty) : String(qty),
      unitUsed: d.unitUsed || "kg",
      unitPrice: bonusOnly ? String(bonusVal || price) : String(price),
      bonusQuantity: String(bonusQty),
      bonusUnitValue: String(bonusVal),
      notes: String(d.notes || "")
    };

    const editIdx = editingItemIndex;
    setItems((prev) => {
      if (editIdx !== null) {
        return prev.map((row, i) => (i === editIdx ? newRow : row));
      }
      return [...prev, newRow];
    });

    if (editIdx !== null) {
      setEditingItemIndex(null);
      setToast("Item atualizado na nota.", "success");
    } else {
      setToast("Item adicionado à nota.", "success");
    }
    setTimeout(() => setToast(""), 2800);
    setDraftItem({ ...EMPTY_DRAFT_ITEM, unitUsed: d.unitUsed || EMPTY_DRAFT_ITEM.unitUsed });
  }, [draftItem, products, editingItemIndex]);

  const loadItemForEdit = useCallback(
    (index) => {
      const row = items[index];
      if (!row) return;
      const product = products.find((p) => p.id === row.productId);
      const bonusOnly = isBonificationOnlyLine(row);
      const refUnitValue = String(row.bonusUnitValue || (bonusOnly ? row.unitPrice : "") || "");
      setDraftItem({
        productId: row.productId || "",
        aiRawProductName: row.aiRawProductName,
        category: row.category || product?.category || "",
        quantity: String(row.quantity ?? ""),
        unitUsed: row.unitUsed || "kg",
        unitPrice: String(row.unitPrice ?? ""),
        lineType: row.lineType === "venda" ? "venda" : "insumo",
        isBonificationOnly: bonusOnly,
        bonusQuantity: String(row.bonusQuantity ?? ""),
        bonusUnitValue: refUnitValue,
        notes: String(row.notes || "")
      });
      setEditingItemIndex(index);
      const label = product?.name || row.aiRawProductName || "item";
      setToast(`A editar «${label}». Altere os campos e toque em «Guardar alteração».`);
      setTimeout(() => setToast(""), 4500);
    },
    [items, products]
  );

  const cancelItemEdit = useCallback(() => {
    setEditingItemIndex(null);
    setDraftItem({ ...EMPTY_DRAFT_ITEM });
  }, []);

  useEffect(() => {
    if (editingItemIndex == null) return;
    if (editingItemIndex < 0 || editingItemIndex >= items.length) {
      setEditingItemIndex(null);
      setDraftItem({ ...EMPTY_DRAFT_ITEM });
    }
  }, [editingItemIndex, items.length]);

  const updateItem = useCallback((index, patch) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const markItemAsPaidPurchase = useCallback((index) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index && isBonificationOnlyLine(row) ? { ...row, isBonificationOnly: false } : row))
    );
    setToast("Item marcado como compra paga — total da nota atualizado.");
    setTimeout(() => setToast(""), 3200);
  }, []);

  const removeItem = useCallback(
    (index) => {
      setItems((prev) => prev.filter((_, i) => i !== index));
      if (!recordAiHighlights) return;
      setAiHighlightKeys((prev) => {
        const n = new Set();
        for (const k of prev) {
          const ks = String(k);
          if (!ks.startsWith("item.")) {
            n.add(k);
            continue;
          }
          const m = /^item\.(\d+)$/.exec(ks);
          if (!m) continue;
          const i = Number(m[1]);
          if (i < index) n.add(`item.${i}`);
          else if (i > index) n.add(`item.${i - 1}`);
        }
        return n;
      });
    },
    [recordAiHighlights]
  );

  const removeItemAt = useCallback(
    (index) => {
      setEditingItemIndex((editIdx) => {
        if (editIdx === index) {
          setDraftItem({ ...EMPTY_DRAFT_ITEM });
          return null;
        }
        if (editIdx !== null && editIdx > index) return editIdx - 1;
        return editIdx;
      });
      removeItem(index);
    },
    [removeItem]
  );

  const clearAiHighlight = useCallback(
    (key) => {
      if (!recordAiHighlights) return;
      setAiHighlightKeys((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    },
    [recordAiHighlights]
  );

  const clearItemRowAiHighlight = useCallback(
    (index) => {
      if (!recordAiHighlights) return;
      setAiHighlightKeys((prev) => {
        const n = new Set(prev);
        n.delete(`item.${index}`);
        return n;
      });
    },
    [recordAiHighlights]
  );

  const appendReceipts = useCallback((fileList) => {
    const added = Array.from(fileList || []).filter(Boolean);
    if (!added.length) return;
    setReceipts((prev) => {
      const { files, skipped } = mergeUniqueReceiptFiles(prev, added);
      if (skipped > 0) {
        setToast(`Limite de ${MAX_RECEIPT_FILES} ficheiros. Alguns não foram adicionados.`);
        setTimeout(() => setToast(""), 4000);
      }
      const newOnes = files.slice(prev.length);
      if (newOnes.length) warmReceiptCompressCache(newOnes);
      return files;
    });
  }, []);

  const removeReceiptAt = useCallback((index) => {
    setReceipts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearReceipts = useCallback(() => {
    setReceipts([]);
    setReceiptExtras([]);
    setDocumentTotals(null);
  }, []);

  const appendReceiptExtras = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList || []).filter(Boolean);
      if (!incoming.length) return;
      setReceiptExtras((prev) => {
        const keys = new Set([...receipts, ...prev].map(receiptFileKey));
        const next = [...prev];
        const newlyAdded = [];
        for (const f of incoming) {
          const k = receiptFileKey(f);
          if (!keys.has(k)) {
            keys.add(k);
            next.push(f);
            newlyAdded.push(f);
          }
        }
        if (newlyAdded.length) warmReceiptCompressCache(newlyAdded);
        return next;
      });
    },
    [receipts]
  );

  const removeReceiptExtraAt = useCallback((index) => {
    setReceiptExtras((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const createProduct = useCallback(
    async (name, lineTypeOpt, categoryOpt) => {
      const trimmed = String(name || "").trim();
      if (trimmed.length < 2) {
        const msg = catalogUserMessage("product", { reason: "too_short", value: trimmed });
        setToast(msg);
        setTimeout(() => setToast(""), 4200);
        return { ok: false, message: msg };
      }
      const categoryRaw = String(categoryOpt || "").trim();
      const usedDefaultCategory = categoryRaw.length < 2;
      const category = usedDefaultCategory ? "Outros" : categoryRaw;
      const lineType = lineTypeOpt === "venda" ? "venda" : "insumo";
      setProductCreating(true);
      try {
        const { data } = await api.post(
          "/catalog/products/quick",
          {
            name: trimmed,
            type: lineType,
            category,
            exactNameOnly: true,
            ...(supplierId ? { supplierId } : {})
          },
          withAuth(token)
        );
        setProducts((prev) =>
          [...prev.filter((p) => p.id !== data.id), data].sort((a, b) =>
            String(a.name).localeCompare(String(b.name), "pt-BR")
          )
        );
        const catHint = usedDefaultCategory ? " (categoria Outros)" : "";
        setToast(
          data.reused
            ? `Produto já existia: “${data.name}”.`
            : `Produto “${data.name}” adicionado ao catálogo${catHint}.`
        );
        setTimeout(() => setToast(""), 2800);
        logCatalog("create_ok", "product", { value: trimmed, reused: data.reused });
        return { ok: true, ...data, displayName: data.name };
      } catch (err) {
        const msg = catalogMessageFromApiError("product", trimmed, err, "create");
        setToast(msg);
        setTimeout(() => setToast(""), 5500);
        return { ok: false, message: msg };
      } finally {
        setProductCreating(false);
      }
    },
    [token, supplierId]
  );

  const createSupplier = useCallback(
    async (name) => {
      const trimmed = String(name || "").trim();
      if (trimmed.length < 2) {
        const msg = catalogUserMessage("supplier", { reason: "too_short", value: trimmed });
        setToast(msg);
        setTimeout(() => setToast(""), 4200);
        return { ok: false, message: msg };
      }
      setSupplierCreating(true);
      try {
        let storeId = overview?.storeIds?.[0];
        if (!storeId) {
          const { data: stores } = await api.get("/catalog/stores", withAuth(token));
          storeId = stores?.[0]?.id;
        }
        if (!storeId) {
          const msg = catalogUserMessage("supplier", { reason: "no_store", value: trimmed });
          setToast(msg);
          setTimeout(() => setToast(""), 5500);
          return { ok: false, message: msg };
        }
        const { data } = await api.post("/catalog/suppliers", { name: trimmed, storeId }, withAuth(token));
        setSuppliers((prev) =>
          [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"))
        );
        setSupplierId(data.id);
        clearAiHighlight("supplierId");
        setToast(`Fornecedor “${data.name}” adicionado.`);
        setTimeout(() => setToast(""), 2800);
        logCatalog("create_ok", "supplier", { value: trimmed, id: data.id });
        return { ok: true, data };
      } catch (err) {
        const msg = catalogMessageFromApiError("supplier", trimmed, err, "create");
        setToast(msg);
        setTimeout(() => setToast(""), 5500);
        return { ok: false, message: msg };
      } finally {
        setSupplierCreating(false);
      }
    },
    [token, overview, clearAiHighlight]
  );

  const resetAfterSubmit = useCallback(() => {
    setItems([]);
    setInstallments([]);
    setTaxes([]);
    setExtras([]);
    setNotes("");
    setDocumentMetadata({ ...EMPTY_DOCUMENT_METADATA });
    setAiFieldConfidence({});
    setDocumentTotals(null);
    setInvoiceNumber("");
    setReceipts([]);
    setReceiptExtras([]);
    setDraftItem({ ...EMPTY_DRAFT_ITEM });
    setSupplierId("");
    setEditingItemIndex(null);
    setAiHighlightKeys(new Set());
    onAfterConfirm?.();
  }, [onAfterConfirm]);

  const savePurchaseDraft = useCallback(
    async ({ draftId = null, createDraft, persistDraft, uploadDraftReceipts } = {}) => {
      if (!supplierId) {
        setToast("Selecione o fornecedor antes de guardar.");
        setTimeout(() => setToast(""), 4500);
        return null;
      }
      if (!items.length) {
        setToast("Adicione pelo menos um item antes de guardar.");
        setTimeout(() => setToast(""), 4500);
        return null;
      }
      setConfirming(true);
      const workItems = [...items];
      for (let i = 0; i < workItems.length; i += 1) {
        const row = workItems[i];
        const category = resolveItemCategory(row, products);
        if (!category) {
          setToast("Informe a categoria em todas as linhas.");
          setTimeout(() => setToast(""), 4500);
          setConfirming(false);
          return null;
        }
        if (row.productId) {
          workItems[i] = { ...row, category };
          continue;
        }
        const label = String(row.aiRawProductName || "").trim();
        if (!label) {
          setToast("Cada linha precisa de um produto associado.");
          setTimeout(() => setToast(""), 4500);
          setConfirming(false);
          return null;
        }
        try {
          const { data } = await api.post(
            "/catalog/products/quick",
            {
              name: label,
              type: row.lineType === "venda" ? "venda" : "insumo",
              category,
              ...(supplierId ? { supplierId } : {})
            },
            withAuth(token)
          );
          workItems[i] = { ...row, productId: data.id, aiRawProductName: undefined };
          setProducts((prev) =>
            [...prev.filter((p) => p.id !== data.id), data].sort((a, b) =>
              String(a.name).localeCompare(String(b.name), "pt-BR")
            )
          );
        } catch (err) {
          const msg = err?.response?.data?.message || "Não foi possível criar produto.";
          setToast(msg);
          setTimeout(() => setToast(""), 4500);
          setConfirming(false);
          return null;
        }
      }
      setItems(workItems);

      const purchaseDate = toPurchaseDatePayload(date);
      if (!purchaseDate) {
        setToast("Informe uma data válida para a compra.");
        setTimeout(() => setToast(""), 4500);
        setConfirming(false);
        return null;
      }

      for (const row of workItems) {
        const unitPrice = parseBrNumber(row.unitPrice);
        const quantity = parseBrNumber(row.quantity);
        const bonusQty = parseBrNumber(row.bonusQuantity) || 0;
        if (isBonificationOnlyLine(row)) {
          if (bonusQty <= 0 && quantity <= 0) {
            setToast("Revise os produtos de bonificação.");
            setTimeout(() => setToast(""), 5000);
            setConfirming(false);
            return null;
          }
        } else if (
          (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) &&
          bonusQty <= 0
        ) {
          setToast("Revise quantidade e preço nas linhas de compra.");
          setTimeout(() => setToast(""), 5000);
          setConfirming(false);
          return null;
        }
        if (!row.productId) {
          setToast("Cada linha precisa de um produto associado.");
          setTimeout(() => setToast(""), 4500);
          setConfirming(false);
          return null;
        }
      }

      try {
        let activeDraftId = draftId;
        if (!activeDraftId && createDraft) activeDraftId = await createDraft();
        if (!activeDraftId) {
          setToast("Não foi possível criar o rascunho.");
          setTimeout(() => setToast(""), 4500);
          setConfirming(false);
          return null;
        }
        if (uploadDraftReceipts && receipts.length) await uploadDraftReceipts(receipts, activeDraftId);
        await persistDraft(
          {
            supplierId: supplierId || null,
            purchaseDate: date,
            invoiceNumber,
            wizardStep: 6,
            items: workItems,
            installments,
            taxes: serializeAdjustmentLines(taxes),
            extras: serializeAdjustmentLines(extras),
            notes: notes || ""
          },
          activeDraftId
        );
        setToast("Rascunho guardado. Veja em Histórico para editar ou publicar.", "success");
        resetAfterSubmit();
        setTimeout(() => setToast(""), 3200);
        return activeDraftId;
      } catch (err) {
        const msg = err?.response?.data?.message || "Não foi possível guardar o rascunho.";
        setToast(msg);
        setTimeout(() => setToast(""), 6000);
        return null;
      } finally {
        setConfirming(false);
      }
    },
    [
      token,
      items,
      products,
      supplierId,
      date,
      invoiceNumber,
      receipts,
      installments,
      taxes,
      extras,
      notes,
      resetAfterSubmit
    ]
  );

  const confirmPurchase = useCallback(
    async ({ draftId = null, serverReceiptCount = 0, uploadDraftReceipts, createDraft, persistDraft } = {}) => {
    const hasReceipts = receipts.length > 0 || serverReceiptCount > 0;
    if (!hasReceipts) {
      setToast("Para publicar, anexe pelo menos uma foto ou PDF da nota (passo 5 ou ao editar o rascunho).");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    if (!supplierId) {
      setToast("Selecione o fornecedor antes de confirmar.");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    if (!items.length) {
      setToast("Adicione pelo menos um item à compra.");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    setConfirming(true);
    const workItems = [...items];
    for (let i = 0; i < workItems.length; i += 1) {
      const row = workItems[i];
      const category = resolveItemCategory(row, products);
      if (!category) {
        setToast("Informe a categoria em todas as linhas antes de confirmar.");
        setTimeout(() => setToast(""), 4500);
        setConfirming(false);
        return;
      }
      if (row.productId) {
        workItems[i] = { ...row, category };
        continue;
      }
      const label = String(row.aiRawProductName || "").trim();
      if (!label) {
        setToast("Cada linha precisa de um produto do catálogo ou do texto da nota para criar o item automaticamente.");
        setTimeout(() => setToast(""), 4500);
        setConfirming(false);
        return;
      }
      try {
        const { data } = await api.post(
          "/catalog/products/quick",
          {
            name: label,
            type: row.lineType === "venda" ? "venda" : "insumo",
            category,
            ...(supplierId ? { supplierId } : {})
          },
          withAuth(token)
        );
        workItems[i] = { ...row, productId: data.id, aiRawProductName: undefined };
        setProducts((prev) =>
          [...prev.filter((p) => p.id !== data.id), data].sort((a, b) =>
            String(a.name).localeCompare(String(b.name), "pt-BR")
          )
        );
      } catch (err) {
        const msg = err?.response?.data?.message || "Não foi possível criar produto a partir da linha.";
        setToast(msg);
        setTimeout(() => setToast(""), 4500);
        setConfirming(false);
        return;
      }
    }
    setItems(workItems);

    const purchaseDate = toPurchaseDatePayload(date);
    if (!purchaseDate) {
      setToast("Informe uma data válida para a compra.");
      setTimeout(() => setToast(""), 4500);
      setConfirming(false);
      return;
    }

    const { grandTotal } = purchaseInvoiceSummary(workItems, taxes, extras);
    if (installments.length > 0) {
      const instCheck = validateInstallmentsAgainstPayable(installments, grandTotal);
      if (!instCheck.ok && grandTotal > 0) {
        setToast(
          `A soma das parcelas (${instCheck.sum}) deve igualar o total da nota (${grandTotal}).`
        );
        setTimeout(() => setToast(""), 5500);
        setConfirming(false);
        return;
      }
    }

    for (const row of workItems) {
      const unitPrice = parseBrNumber(row.unitPrice);
      const quantity = parseBrNumber(row.quantity);
      const bonusQty = parseBrNumber(row.bonusQuantity) || 0;
      if (isBonificationOnlyLine(row)) {
        if (bonusQty <= 0 && quantity <= 0) {
          setToast("Revise os produtos de bonificação (quantidade).");
          setTimeout(() => setToast(""), 5000);
          setConfirming(false);
          return;
        }
      } else if (
        (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) &&
        bonusQty <= 0
      ) {
        setToast("Revise quantidade e preço nas linhas de compra.");
        setTimeout(() => setToast(""), 5000);
        setConfirming(false);
        return;
      }
      if (!row.productId) {
        setToast("Cada linha precisa de um produto associado antes de confirmar.");
        setTimeout(() => setToast(""), 4500);
        setConfirming(false);
        return;
      }
    }

    try {
      const payload = workItems.map((item) => ({
        productId: item.productId,
        supplierId: item.supplierId || supplierId,
        unitPrice: parseBrNumber(item.unitPrice) || 0,
        unitUsed: String(item.unitUsed || "").trim() || "un",
        quantity: parseBrNumber(item.quantity) || 0,
        purchaseDate,
        weekOfMonth: toWeekOfMonth(date),
        lineType: item.lineType === "venda" ? "venda" : "insumo",
        isBonificationOnly: isBonificationOnlyLine(item),
        bonusQuantity: parseBrNumber(item.bonusQuantity) || 0,
        bonusUnitValue: parseBrNumber(item.bonusUnitValue) || 0,
        notes: item.notes ? String(item.notes).trim().slice(0, 500) || null : null
      }));

      const instPayload = installments.map((row) => ({
        dueDate: row.dueDate,
        amount: parseBrNumber(row.amount) || 0,
        notes: row.notes || ""
      }));

      const taxPayload = serializeAdjustmentLines(taxes);
      const extraPayload = serializeAdjustmentLines(extras);

      let activeDraftId = draftId;
      if (!activeDraftId && createDraft) {
        activeDraftId = await createDraft();
        if (persistDraft) {
          await persistDraft(
            {
              supplierId: supplierId || null,
              purchaseDate: date,
              invoiceNumber,
              wizardStep: 6,
              items: workItems,
              installments,
              taxes: taxPayload,
              extras: extraPayload,
              notes: notes || ""
            },
            activeDraftId
          );
        }
      }
      if (uploadDraftReceipts && receipts.length) {
        await uploadDraftReceipts(receipts, activeDraftId);
      }

      const form = new FormData();
      form.append("invoiceNumber", invoiceNumber || `NF-${Date.now()}`);
      form.append("items", JSON.stringify(payload));
      if (instPayload.length) form.append("installments", JSON.stringify(instPayload));
      if (taxPayload.length) form.append("taxes", JSON.stringify(taxPayload));
      if (extraPayload.length) form.append("extras", JSON.stringify(extraPayload));
      if (notes?.trim()) form.append("notes", notes.trim());
      const metaPayload = serializeDocumentMetadata(documentMetadata);
      if (Object.keys(metaPayload).length) form.append("documentMetadata", JSON.stringify(metaPayload));
      if (draftId) form.append("draftId", draftId);

      setToast("A enviar nota e itens…");
      const filesToUpload = await compressReceiptFilesForSubmit([...receipts, ...receiptExtras]);
      const totalBytes = filesToUpload.reduce((s, f) => s + (f.size || 0), 0);
      if (totalBytes > 22 * 1024 * 1024) {
        setToast(
          `Os ficheiros somam ${formatFileSize(totalBytes)}; o limite é cerca de 22 MB. Remova anexos ou use fotos mais leves.`
        );
        setTimeout(() => setToast(""), 6000);
        setConfirming(false);
        return;
      }
      for (const file of filesToUpload) form.append("receipts", file);

      const postUrl = activeDraftId ? `/purchases/drafts/${activeDraftId}/finalize` : "/purchases";
      await api.post(postUrl, form, {
        headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" },
        timeout: 120_000
      });
      setToast("Nota publicada com sucesso.", "success");
      resetAfterSubmit();
      setTimeout(() => setToast(""), 2600);
    } catch (err) {
      const msg = purchaseApiErrorMessage(err);
      console.warn("[confirmPurchase]", err?.response?.status, msg, err?.response?.data);
      setToast(msg);
      setTimeout(() => setToast(""), 8000);
    } finally {
      setConfirming(false);
    }
  },
    [token, items, products, supplierId, date, invoiceNumber, receipts, receiptExtras, installments, taxes, extras, notes, documentMetadata, resetAfterSubmit]
  );

  const clearAnalyzeProgressTimer = useCallback(() => {
    if (analyzeProgressTimerRef.current) {
      clearInterval(analyzeProgressTimerRef.current);
      analyzeProgressTimerRef.current = null;
    }
  }, []);

  const startAnalyzeProgressTimer = useCallback(() => {
    clearAnalyzeProgressTimer();
    analyzeProgressTimerRef.current = setInterval(() => {
      setAiProgress((p) => (p < 88 ? p + 1 : p));
    }, 1800);
  }, [clearAnalyzeProgressTimer]);

  const applyAiImportResult = useCallback(
    (data, { onSuccess } = {}) => {
      const inv = invoiceNumberFromAi(data?.invoiceNumber);
      if (inv) setInvoiceNumber(inv);
      if (data?.purchaseDate) setDate(String(data.purchaseDate).slice(0, 10));
      if (data?.supplierSuggestion?.id) setSupplierId(String(data.supplierSuggestion.id));

      const fromApi = data?.items || [];
      const singleLineInvoice = fromApi.length === 1;
      const mergedRows = fromApi
        .map((row, idx, all) => {
          const built =
            buildItemRowFromAi(row, { singleLineInvoice, allowedUnits: unitOptions }) ||
            buildItemRowFromAiPartial(row, { singleLineInvoice, allowedUnits: unitOptions });
          if (!built) return null;
          const apiRow = all[idx];
          const category =
            String(built.category || apiRow?.category || apiRow?.categoryHint || "").trim() ||
            (built.productId
              ? String(products.find((p) => p.id === built.productId)?.category || "").trim()
              : "");
          const lineType =
            apiRow?.lineType === "venda" || built.lineType === "venda" ? "venda" : "insumo";
          return {
            ...built,
            category,
            lineType,
            notes: apiRow?.notes ? String(apiRow.notes) : built.notes || "",
            notesConfidence: apiRow?.notesConfidence || built.notesConfidence || null
          };
        })
        .filter(Boolean);

      const productStubs = fromApi
        .filter((row) => row.productId && row.productName)
        .map((row) => ({
          id: row.productId,
          name: row.productName,
          category: row.category || null,
          type: row.lineType === "venda" ? "venda" : "insumo"
        }));
      if (productStubs.length) {
        setProducts((prev) => {
          const byId = new Map((prev || []).map((p) => [p.id, p]));
          for (const stub of productStubs) {
            const cur = byId.get(stub.id) || {};
            byId.set(stub.id, { ...cur, ...stub });
          }
          return [...byId.values()].sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
          );
        });
      }

      if (fromApi.length) {
        setItems(mergedRows);
        setDraftItem({ ...EMPTY_DRAFT_ITEM, unitUsed: "un" });
      }

      const missingRows = [];
      for (const [idx, it] of fromApi.entries()) {
        if (it.missing?.length)
          missingRows.push(`Item ${idx + 1} (${it.rawProductName || "produto"}): ${it.missing.join(", ")}`);
      }
      for (const g of data?.missingGlobal || []) missingRows.push(`Nota: ${g}`);
      setAiMissing(missingRows);
      setDocumentTotals(data?.documentTotals ?? null);

      if (Array.isArray(data?.taxes) && data.taxes.length) setTaxes(mapApiAdjustmentLines(data.taxes));
      else setTaxes([]);

      if (Array.isArray(data?.extras) && data.extras.length) setExtras(mapApiAdjustmentLines(data.extras));
      else setExtras([]);

      if (data?.notes) setNotes(String(data.notes));
      else setNotes("");

      setDocumentMetadata(mapApiMetadataToForm(data?.documentMetadata));

      if (Array.isArray(data?.suggestedInstallments) && data.suggestedInstallments.length) {
        setInstallments(mapApiInstallments(data.suggestedInstallments));
      }

      const conf = data?.fieldConfidence && typeof data.fieldConfidence === "object" ? data.fieldConfidence : {};
      setAiFieldConfidence(conf);

      if (recordAiHighlights) {
        const keys = new Set();
        if (inv) keys.add("invoiceNumber");
        if (data?.purchaseDate) keys.add("date");
        if (data?.supplierSuggestion?.id) keys.add("supplierId");
        for (const [key, level] of Object.entries(conf)) {
          if (needsReview(level)) {
            keys.add(key);
            if (
              [
                "accessKey",
                "series",
                "issueDate",
                "exitDate",
                "orderNumber",
                "paymentTerms",
                "paymentDeadlineDays",
                "salesRep",
                "carrierName",
                "complementaryInfo"
              ].includes(key)
            ) {
              keys.add(`metadata.${key}`);
            }
          }
        }
        mergedRows.forEach((row, idx) => {
          keys.add(`item.${idx}`);
          if (needsReview(row.notesConfidence)) keys.add(`itemNotes.${idx}`);
        });
        if (data?.taxes?.length) keys.add("taxes");
        if (data?.extras?.length) keys.add("extras");
        if (data?.suggestedInstallments?.length) keys.add("installments");
        setAiHighlightKeys(keys);
      }

      if (onSuccess) {
        onSuccess(data, {
          autoItems: mergedRows,
          fromApi,
          suggestedSupplier: Boolean(data?.supplierSuggestion?.id)
        });
      }

      setAiStage("finish");
      setAiProgress(100);
      setAiStatusMessage("Análise concluída.");

      if (!missingRows.length) {
        setToast("Leitura concluída. Revise impostos, produtos e parcelas antes de publicar.");
        setTimeout(() => setToast(""), 3200);
      } else if (fromApi.length === 0 && !inv && !data?.supplierSuggestion?.id) {
        setToast("A IA não extraiu dados desta nota. Toque em «Analisar com IA» para tentar de novo.");
        setTimeout(() => setToast(""), 4500);
      } else {
        setToast("IA sugeriu parte dos dados. Complete ou corrija os campos indicados abaixo.");
        setTimeout(() => setToast(""), 3800);
      }
      return true;
    },
    [products, recordAiHighlights, unitOptions]
  );

  const getAiFieldClass = useCallback(
    (key) => {
      if (!recordAiHighlights) return "";
      return confidenceClass(key, aiFieldConfidence, aiHighlightKeys);
    },
    [recordAiHighlights, aiFieldConfidence, aiHighlightKeys]
  );

  const parseReceiptsByAI = useCallback(
    async (opts = {}) => {
      const { onSuccess, isRetry = false } = opts;
      if (!receipts.length) return false;
      setAiLoading(true);
      setAiMissing([]);
      setAiError("");
      if (!isRetry) setAiRetryCount(0);

      const t0 = performance.now();
      let filesToSend = receipts;

      try {
        setAiStage("optimize");
        setAiProgress(4);
        setAiStatusMessage("A preparar a foto para envio (mantendo nitidez para a IA)…");

        const originalBytes = receipts.reduce((s, f) => s + (f.size || 0), 0);
        filesToSend = await compressReceiptFilesForAi(receipts, {
          onFileStart: ({ name, index, total }) => {
            setAiStatusMessage(`Otimizando ${index + 1}/${total}: ${name}`);
            setAiProgress(4 + Math.round(((index + 1) / total) * 12));
          }
        });
        const compressedBytes = filesToSend.reduce((s, f) => s + (f.size || 0), 0);
        setAiProgress(18);
        const saved =
          compressedBytes < originalBytes
            ? ` Enviando ${formatFileSize(compressedBytes)} em vez de ${formatFileSize(originalBytes)}.`
            : "";
        setAiStatusMessage(`Foto pronta.${saved}`);

        const form = new FormData();
        for (const file of filesToSend) form.append("receipts", file);
        if (supplierId) form.append("supplierId", supplierId);

        let lastErr = null;
        let data = null;
        for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt += 1) {
          if (attempt > 0) {
            setAiRetryCount(attempt);
            setAiStatusMessage(`Nova tentativa (${attempt + 1}/${AI_MAX_RETRIES + 1})…`);
            await sleep(1200 * attempt);
          }
          try {
            setAiStage("upload");
            setAiProgress(22);
            setAiStatusMessage("A enviar para o servidor…");
            setAiStage("analyze");
            startAnalyzeProgressTimer();

            const uploadStart = performance.now();
            const res = await api.post("/purchases/receipt-ai-parse", form, {
              headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" },
              timeout: AI_REQUEST_TIMEOUT_MS,
              onUploadProgress: (ev) => {
                if (!ev.total) return;
                const pct = 18 + Math.round((ev.loaded / ev.total) * 32);
                setAiProgress(pct);
                if (ev.loaded >= ev.total) {
                  setAiStage("analyze");
                  setAiStatusMessage("IA a analisar a nota…");
                }
              }
            });
            clearAnalyzeProgressTimer();
            const uploadMs = Math.round(performance.now() - uploadStart);
            console.info("[receipt-ai] cliente ok", {
              uploadMs,
              totalMs: Math.round(performance.now() - t0),
              bytes: compressedBytes,
              files: filesToSend.length
            });
            data = res.data;
            lastErr = null;
            break;
          } catch (err) {
            clearAnalyzeProgressTimer();
            lastErr = err;
            if (attempt < AI_MAX_RETRIES && isRetryableAiError(err)) continue;
            throw err;
          }
        }
        if (!data) throw lastErr || new Error("Falha ao analisar nota.");

        setAiStage("extract");
        setAiProgress(92);
        setAiStatusMessage("A organizar produtos, impostos e parcelas…");

        return applyAiImportResult(data, { onSuccess });
      } catch (err) {
        clearAnalyzeProgressTimer();
        const st = err?.response?.status;
        console.warn("[receipt-ai] cliente falhou", {
          status: st,
          code: err?.code,
          ms: Math.round(performance.now() - t0)
        });
        const finalMsg = receiptAiUserFacingMessage(err);
        setAiError(finalMsg);
        setAiMissing([finalMsg]);
        if (recordAiHighlights) setAiHighlightKeys(new Set());
        return false;
      } finally {
        clearAnalyzeProgressTimer();
        setAiLoading(false);
        setTimeout(() => {
          setAiStage(null);
          setAiProgress(0);
          setAiStatusMessage("");
        }, 400);
      }
    },
    [token, receipts, applyAiImportResult, clearAnalyzeProgressTimer, startAnalyzeProgressTimer]
  );

  const retryAiParse = useCallback(() => {
    setAiError("");
    return parseReceiptsByAI({ isRetry: true });
  }, [parseReceiptsByAI]);

  return {
    overview,
    suppliers,
    products,
    catalogUnits,
    unitOptions,
    categoryOptions,
    pickDraftProduct,
    date,
    setDate,
    supplierId,
    setSupplierId,
    invoiceNumber,
    setInvoiceNumber,
    receipts,
    setReceipts,
    appendReceipts,
    removeReceiptAt,
    clearReceipts,
    receiptExtras,
    setReceiptExtras,
    appendReceiptExtras,
    removeReceiptExtraAt,
    items,
    setItems,
    installments,
    setInstallments,
    taxes,
    setTaxes,
    extras,
    setExtras,
    notes,
    setNotes,
    draftItem,
    setDraftItem,
    toast,
    toastType,
    setToast,
    aiLoading,
    aiStage,
    aiProgress,
    aiStatusMessage,
    aiError,
    aiRetryCount,
    aiMissing,
    documentTotals,
    documentMetadata,
    setDocumentMetadata,
    aiFieldConfidence,
    getAiFieldClass,
    invoiceSummary,
    total,
    addItem,
    updateItem,
    markItemAsPaidPurchase,
    removeItem,
    removeItemAt,
    editingItemIndex,
    loadItemForEdit,
    cancelItemEdit,
    savePurchaseDraft,
    confirmPurchase,
    canConfirmPurchase,
    confirming,
    parseReceiptsByAI,
    retryAiParse,
    aiHighlightKeys: recordAiHighlights ? aiHighlightKeys : null,
    clearAiHighlight,
    clearItemRowAiHighlight,
    createSupplier,
    supplierCreating,
    createProduct,
    productCreating
  };
}
