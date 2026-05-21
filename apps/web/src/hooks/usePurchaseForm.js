import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, withAuth } from "../api";
import { buildUnitOptions, normalizeUnitUsed } from "../lib/catalogUnits";
import { compressReceiptFiles, compressReceiptFilesForAi, formatFileSize } from "../lib/compressReceiptImages";
import { MAX_RECEIPT_FILES, mergeUniqueReceiptFiles, receiptFileKey } from "../lib/receiptFiles";

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

function purchaseApiErrorMessage(err) {
  const d = err?.response?.data;
  if (typeof d?.message === "string" && d.message.trim()) return d.message;
  if (d?.details?.fieldErrors) {
    const flat = Object.values(d.details.fieldErrors).flat().filter(Boolean);
    if (flat.length) return `Dados inválidos: ${flat.slice(0, 2).join("; ")}`;
  }
  if (typeof d === "string" && d.trim() && !d.includes("<!DOCTYPE")) return d.trim();
  const st = err?.response?.status;
  if (st === 413) return "Arquivos da nota muito grandes. Tire fotos com menos resolução ou envie menos ficheiros.";
  if (st === 500) return "Erro no servidor ao registar. Tente de novo; se persistir, contacte o suporte.";
  return "Não foi possível registar a compra. Tente novamente.";
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
  lineType: "insumo"
};

function buildItemRowFromAi(it, { singleLineInvoice, allowedUnits }) {
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
    aiLineTotal: Number.isFinite(Number(it.lineTotal)) ? Number(it.lineTotal) : undefined
  };
}

/** Linha para a lista mesmo sem produto no catálogo (preço obrigatório; qtd default 1 se inválida). */
function buildItemRowFromAiPartial(it, { singleLineInvoice, allowedUnits }) {
  const priceNum = it.unitPrice != null ? Number(it.unitPrice) : NaN;
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  let qty = it.quantity != null ? Number(it.quantity) : NaN;
  if (!Number.isFinite(qty) || qty <= 0) {
    qty = singleLineInvoice ? 1 : 1;
  }
  const raw = String(it.rawProductName || it.productName || "").trim();
  return {
    productId: it.productId || "",
    category: String(it.category || it.categoryHint || "").trim(),
    aiRawProductName: raw || undefined,
    quantity: String(qty),
    unitUsed: normalizeUnitUsed(it.unitUsed, allowedUnits),
    unitPrice: String(priceNum),
    lineType: it.lineType === "venda" ? "venda" : "insumo",
    aiLineTotal: Number.isFinite(Number(it.lineTotal)) ? Number(it.lineTotal) : undefined
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
  const [toast, setToast] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiRetryCount, setAiRetryCount] = useState(0);
  const [aiMissing, setAiMissing] = useState([]);
  const [documentTotals, setDocumentTotals] = useState(null);
  const analyzeProgressTimerRef = useRef(null);
  const [aiHighlightKeys, setAiHighlightKeys] = useState(() => new Set());
  const [supplierCreating, setSupplierCreating] = useState(false);
  const [productCreating, setProductCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
        return { ...d, productId, lineType, unitUsed, category };
      });
    },
    [products, unitOptions]
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0),
    [items]
  );

  const canConfirmPurchase = useMemo(() => {
    if (aiLoading || confirming) return false;
    if (!supplierId || !receipts.length || !items.length) return false;
    return items.every((it) => {
      const hasProduct = Boolean(it.productId) || String(it.aiRawProductName || "").trim().length >= 2;
      const category = resolveItemCategory(it, products);
      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);
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
    setDraftItem((d) => {
      const category = resolveItemCategory(d, products);
      if (!d.productId || !d.quantity || !d.unitPrice) {
        setToast("Preencha produto, quantidade e valor unitário.");
        setTimeout(() => setToast(""), 3200);
        return d;
      }
      if (!category) {
        setToast("Informe a categoria do item.");
        setTimeout(() => setToast(""), 3200);
        return d;
      }
      setItems((prev) => [...prev, { ...d, category }]);
      return { ...EMPTY_DRAFT_ITEM };
    });
  }, [products]);

  const updateItem = useCallback((index, patch) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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
      const added = Array.from(fileList || []).filter(Boolean);
      if (!added.length) return;
      setReceiptExtras((prev) => {
        const keys = new Set([...receipts, ...prev].map(receiptFileKey));
        const next = [...prev];
        for (const f of added) {
          const k = receiptFileKey(f);
          if (!keys.has(k)) {
            keys.add(k);
            next.push(f);
          }
        }
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
        setToast("O nome do produto deve ter pelo menos 2 caracteres.");
        setTimeout(() => setToast(""), 3200);
        return null;
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
          data.reused ? `Produto já existia: “${data.name}”.` : `Produto “${data.name}” adicionado${catHint}.`
        );
        setTimeout(() => setToast(""), 2800);
        return data;
      } catch (err) {
        const d = err?.response?.data;
        let msg = "Não foi possível criar o produto.";
        if (typeof d?.message === "string") msg = d.message;
        setToast(msg);
        setTimeout(() => setToast(""), 4200);
        return null;
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
        setToast("O nome do fornecedor deve ter pelo menos 2 caracteres.");
        setTimeout(() => setToast(""), 3200);
        return;
      }
      setSupplierCreating(true);
      try {
        let storeId = overview?.storeIds?.[0];
        if (!storeId) {
          const { data: stores } = await api.get("/catalog/stores", withAuth(token));
          storeId = stores?.[0]?.id;
        }
        if (!storeId) {
          setToast("Não há loja cadastrada. Crie uma loja no painel admin antes de adicionar fornecedor.");
          setTimeout(() => setToast(""), 4500);
          return;
        }
        const { data } = await api.post("/catalog/suppliers", { name: trimmed, storeId }, withAuth(token));
        setSuppliers((prev) =>
          [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"))
        );
        setSupplierId(data.id);
        clearAiHighlight("supplierId");
        setToast(`Fornecedor “${data.name}” adicionado.`);
        setTimeout(() => setToast(""), 2800);
      } catch (err) {
        const d = err?.response?.data;
        let msg = "Não foi possível criar o fornecedor.";
        if (typeof d?.message === "string") msg = d.message;
        else if (Array.isArray(d?.formErrors?.fieldErrors?.name)) msg = d.formErrors.fieldErrors.name[0];
        setToast(msg);
        setTimeout(() => setToast(""), 4200);
      } finally {
        setSupplierCreating(false);
      }
    },
    [token, overview, clearAiHighlight]
  );

  const confirmPurchase = useCallback(async () => {
    if (!receipts.length) {
      setToast("É obrigatório anexar pelo menos um ficheiro da nota fiscal.");
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

    for (const row of workItems) {
      const unitPrice = Number(row.unitPrice);
      const quantity = Number(row.quantity);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        setToast("Revise quantidade e preço unitário em todas as linhas (valores numéricos maiores que zero).");
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
        supplierId,
        unitPrice: Number(item.unitPrice),
        unitUsed: String(item.unitUsed || "").trim() || "un",
        quantity: Number(item.quantity),
        purchaseDate,
        weekOfMonth: toWeekOfMonth(date),
        lineType: item.lineType === "venda" ? "venda" : "insumo"
      }));
      const form = new FormData();
      form.append("invoiceNumber", invoiceNumber || `NF-${Date.now()}`);
      form.append("items", JSON.stringify(payload));
      const filesToUpload = await compressReceiptFiles([...receipts, ...receiptExtras]);
      for (const file of filesToUpload) form.append("receipts", file);
      await api.post("/purchases", form, {
        headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" }
      });
      setToast("Lançamento confirmado com sucesso.");
      setItems([]);
      setInvoiceNumber("");
      setReceipts([]);
      setReceiptExtras([]);
      setAiHighlightKeys(new Set());
      onAfterConfirm?.();
      setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(purchaseApiErrorMessage(err));
      setTimeout(() => setToast(""), 5000);
    } finally {
      setConfirming(false);
    }
  }, [token, items, products, supplierId, date, invoiceNumber, receipts, receiptExtras, onAfterConfirm]);

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
        setAiStatusMessage("A organizar produtos e valores…");

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
            return { ...built, category, lineType };
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

        if (recordAiHighlights) {
          const keys = new Set();
          if (inv) keys.add("invoiceNumber");
          if (data?.purchaseDate) keys.add("date");
          if (data?.supplierSuggestion?.id) keys.add("supplierId");
          mergedRows.forEach((_, idx) => keys.add(`item.${idx}`));
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
          setToast("Leitura concluída. Revise os dados nas etapas e confirme ou ajuste o que precisar.");
          setTimeout(() => setToast(""), 3200);
        } else {
          setToast("IA sugeriu parte dos dados. Complete ou corrija os campos indicados abaixo.");
          setTimeout(() => setToast(""), 3800);
        }
        return true;
      } catch (err) {
        clearAnalyzeProgressTimer();
        const st = err?.response?.status;
        let msg = typeof err?.response?.data?.message === "string" ? err.response.data.message : "";
        if (err?.message && !msg) msg = err.message;
        if (st === 413) {
          msg =
            "O servidor recusou o tamanho do ficheiro (413). Tire outra foto com menos zoom ou tente de novo; fotos são otimizadas automaticamente.";
        }
        if (!msg && st === 504) {
          msg = "O servidor demorou demais (504). Toque em «Tentar novamente» ou use uma foto mais leve.";
        }
        if (!msg && err?.code === "ECONNABORTED") {
          msg = `Tempo esgotado (${AI_REQUEST_TIMEOUT_MS / 1000}s). Verifique a rede e use «Tentar novamente».`;
        }
        const finalMsg = msg || "Não foi possível ler a nota com IA.";
        setAiError(finalMsg);
        setAiMissing([finalMsg]);
        if (recordAiHighlights) setAiHighlightKeys(new Set());
        console.warn("[receipt-ai] cliente falhou", {
          status: st,
          code: err?.code,
          message: finalMsg,
          ms: Math.round(performance.now() - t0)
        });
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
    [token, receipts, products, recordAiHighlights, supplierId, unitOptions, clearAnalyzeProgressTimer, startAnalyzeProgressTimer]
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
    draftItem,
    setDraftItem,
    toast,
    setToast,
    aiLoading,
    aiStage,
    aiProgress,
    aiStatusMessage,
    aiError,
    aiRetryCount,
    aiMissing,
    documentTotals,
    total,
    addItem,
    updateItem,
    removeItem,
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
