import { useCallback, useEffect, useMemo, useState } from "react";
import { api, withAuth } from "../api";
import { buildUnitOptions, normalizeUnitUsed } from "../lib/catalogUnits";

function receiptFileKey(f) {
  return `${f?.name || ""}:${f?.size}:${f?.lastModified}`;
}

export function toWeekOfMonth(dateStr) {
  const date = new Date(dateStr);
  return Math.ceil(date.getDate() / 7);
}

/** Normaliza número da NF vindo da IA (pode ser número ou string). */
export function invoiceNumberFromAi(value) {
  if (value == null) return "";
  const s = String(value).trim();
  return s || "";
}

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
    quantity: String(qty),
    unitUsed: normalizeUnitUsed(it.unitUsed, allowedUnits),
    unitPrice: String(priceNum),
    lineType: it.lineType === "venda" ? "venda" : "insumo"
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
    aiRawProductName: raw || undefined,
    quantity: String(qty),
    unitUsed: normalizeUnitUsed(it.unitUsed, allowedUnits),
    unitPrice: String(priceNum),
    lineType: it.lineType === "venda" ? "venda" : "insumo"
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
  const [catalogUnits, setCatalogUnits] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receipts, setReceipts] = useState([]);
  /** Anexos adicionais só no envio final (não disparam nova leitura por IA). Usado na página Compra com IA. */
  const [receiptExtras, setReceiptExtras] = useState([]);
  const [items, setItems] = useState([]);
  const [draftItem, setDraftItem] = useState({
    productId: "",
    quantity: "",
    unitUsed: "kg",
    unitPrice: "",
    lineType: "insumo"
  });
  const [toast, setToast] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMissing, setAiMissing] = useState([]);
  const [aiHighlightKeys, setAiHighlightKeys] = useState(() => new Set());
  const [supplierCreating, setSupplierCreating] = useState(false);
  const [productCreating, setProductCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get("/catalog/suppliers", withAuth(token)),
      api.get("/catalog/products", withAuth(token)),
      api.get("/catalog/units", withAuth(token)),
      api.get("/manager/overview", withAuth(token))
    ]).then(([supRes, prodRes, unitsRes, ovRes]) => {
      setSuppliers(supRes.data?.length ? supRes.data : []);
      setProducts(prodRes.data?.length ? prodRes.data : []);
      setCatalogUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
      setOverview(ovRes.data ?? null);
    });
  }, [token]);

  const unitOptions = useMemo(() => buildUnitOptions(catalogUnits, products), [catalogUnits, products]);

  const pickDraftProduct = useCallback(
    (productId) => {
      const product = products.find((p) => p.id === productId);
      setDraftItem((d) => {
        const lineType = product?.type === "venda" ? "venda" : "insumo";
        const unitUsed = product?.standard_unit ? normalizeUnitUsed(product.standard_unit, unitOptions) : d.unitUsed;
        return { ...d, productId, lineType, unitUsed };
      });
    },
    [products, unitOptions]
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0),
    [items]
  );

  const addItem = useCallback(() => {
    setDraftItem((d) => {
      if (!d.productId || !d.quantity || !d.unitPrice) return d;
      setItems((prev) => [...prev, { ...d }]);
      return { productId: "", quantity: "", unitUsed: "kg", unitPrice: "", lineType: "insumo" };
    });
  }, []);

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
    async (name, lineTypeOpt) => {
      const trimmed = String(name || "").trim();
      if (trimmed.length < 2) {
        setToast("O nome do produto deve ter pelo menos 2 caracteres.");
        setTimeout(() => setToast(""), 3200);
        return null;
      }
      const lineType = lineTypeOpt === "venda" ? "venda" : "insumo";
      setProductCreating(true);
      try {
        const { data } = await api.post(
          "/catalog/products/quick",
          {
            name: trimmed,
            type: lineType,
            ...(supplierId ? { supplierId } : {})
          },
          withAuth(token)
        );
        setProducts((prev) =>
          [...prev.filter((p) => p.id !== data.id), data].sort((a, b) =>
            String(a.name).localeCompare(String(b.name), "pt-BR")
          )
        );
        setToast(data.reused ? `Produto já existia: “${data.name}”.` : `Produto “${data.name}” adicionado.`);
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
      setToast("É obrigatório anexar pelo menos um arquivo da nota fiscal.");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    const workItems = [...items];
    for (let i = 0; i < workItems.length; i += 1) {
      const row = workItems[i];
      if (row.productId) continue;
      const label = String(row.aiRawProductName || "").trim();
      if (!label) {
        setToast("Cada linha precisa de um produto do catálogo ou do texto da nota para criar o item automaticamente.");
        setTimeout(() => setToast(""), 4500);
        return;
      }
      try {
        const { data } = await api.post(
          "/catalog/products/quick",
          {
            name: label,
            type: row.lineType === "venda" ? "venda" : "insumo",
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
        return;
      }
    }
    setItems(workItems);

    const payload = workItems.map((item) => ({
      productId: item.productId,
      supplierId,
      unitPrice: Number(item.unitPrice),
      unitUsed: item.unitUsed,
      quantity: Number(item.quantity),
      purchaseDate: new Date(date).toISOString(),
      weekOfMonth: toWeekOfMonth(date),
      lineType: item.lineType === "venda" ? "venda" : "insumo"
    }));
    const form = new FormData();
    form.append("invoiceNumber", invoiceNumber || `NF-${Date.now()}`);
    form.append("items", JSON.stringify(payload));
    for (const file of [...receipts, ...receiptExtras]) form.append("receipts", file);
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
  }, [token, items, supplierId, date, invoiceNumber, receipts, receiptExtras, onAfterConfirm]);

  const parseReceiptsByAI = useCallback(
    async (opts = {}) => {
      const { onSuccess } = opts;
      if (!receipts.length) return false;
      setAiLoading(true);
      setAiMissing([]);
      try {
        const form = new FormData();
        for (const file of receipts) form.append("receipts", file);
        if (supplierId) form.append("supplierId", supplierId);
        const { data } = await api.post("/purchases/receipt-ai-parse", form, {
          headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" },
          timeout: 300000
        });

        const inv = invoiceNumberFromAi(data?.invoiceNumber);
        if (inv) setInvoiceNumber(inv);

        if (data?.purchaseDate) setDate(String(data.purchaseDate).slice(0, 10));

        if (data?.supplierSuggestion?.id) setSupplierId(String(data.supplierSuggestion.id));

        const fromApi = data?.items || [];
        const singleLineInvoice = fromApi.length === 1;
        const mergedRows = fromApi
          .map(
            (row) =>
              buildItemRowFromAi(row, { singleLineInvoice, allowedUnits: unitOptions }) ||
              buildItemRowFromAiPartial(row, { singleLineInvoice, allowedUnits: unitOptions })
          )
          .filter(Boolean);

        const productStubs = fromApi
          .filter((row) => row.productId && row.productName)
          .map((row) => ({
            id: row.productId,
            name: row.productName,
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
          setDraftItem({ productId: "", quantity: "", unitUsed: "un", unitPrice: "", lineType: "insumo" });
        }

        const missingRows = [];
        for (const [idx, it] of fromApi.entries()) {
          if (it.missing?.length)
            missingRows.push(`Item ${idx + 1} (${it.rawProductName || "produto"}): ${it.missing.join(", ")}`);
        }
        for (const g of data?.missingGlobal || []) missingRows.push(`Nota: ${g}`);
        setAiMissing(missingRows);

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

        if (!missingRows.length) {
          setToast("Leitura concluída. Revise os dados nas etapas e confirme ou ajuste o que precisar.");
          setTimeout(() => setToast(""), 3200);
        } else {
          setToast("IA sugeriu parte dos dados. Complete ou corrija os campos indicados abaixo.");
          setTimeout(() => setToast(""), 3800);
        }
        return true;
      } catch (err) {
        const st = err?.response?.status;
        let msg = typeof err?.response?.data?.message === "string" ? err.response.data.message : "";
        if (st === 413) {
          msg =
            "O ficheiro é grande demais para o proxy (413). Use foto com menos resolução ou PDF mais leve. Após atualizar o servidor, o limite sobe (até ~25 MB).";
        }
        if (!msg && st === 504) {
          msg = "O proxy encerrou por tempo (504). Tente ficheiro menor ou volte a tentar.";
        }
        if (!msg && err?.code === "ECONNABORTED") {
          msg = "Tempo esgotado ao analisar a nota. Tente ficheiro menor ou verifique a rede.";
        }
        setAiMissing([msg || "Não foi possível ler a nota com IA."]);
        if (recordAiHighlights) setAiHighlightKeys(new Set());
        return false;
      } finally {
        setAiLoading(false);
      }
    },
    [token, receipts, recordAiHighlights, supplierId, unitOptions]
  );

  return {
    overview,
    suppliers,
    products,
    catalogUnits,
    unitOptions,
    pickDraftProduct,
    date,
    setDate,
    supplierId,
    setSupplierId,
    invoiceNumber,
    setInvoiceNumber,
    receipts,
    setReceipts,
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
    aiMissing,
    total,
    addItem,
    updateItem,
    removeItem,
    confirmPurchase,
    parseReceiptsByAI,
    aiHighlightKeys: recordAiHighlights ? aiHighlightKeys : null,
    clearAiHighlight,
    clearItemRowAiHighlight,
    createSupplier,
    supplierCreating,
    createProduct,
    productCreating
  };
}
