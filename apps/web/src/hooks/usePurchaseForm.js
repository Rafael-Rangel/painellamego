import { useCallback, useEffect, useMemo, useState } from "react";
import { api, withAuth } from "../api";

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

function buildItemRowFromAi(it, { singleLineInvoice }) {
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
    unitUsed:
      it.unitUsed && ["kg", "un", "cx", "L", "l", "g", "ml"].includes(String(it.unitUsed))
        ? it.unitUsed === "l"
          ? "L"
          : it.unitUsed
        : "un",
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receipts, setReceipts] = useState([]);
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

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get("/catalog/suppliers", withAuth(token)),
      api.get("/catalog/products", withAuth(token)),
      api.get("/manager/overview", withAuth(token))
    ]).then(([supRes, prodRes, ovRes]) => {
      setSuppliers(supRes.data?.length ? supRes.data : []);
      setProducts(prodRes.data?.length ? prodRes.data : []);
      setOverview(ovRes.data ?? null);
    });
  }, [token]);

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

  const confirmPurchase = useCallback(async () => {
    const payload = items.map((item) => ({
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
    for (const file of receipts) form.append("receipts", file);
    await api.post("/purchases", form, {
      headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" }
    });
    setToast("Lançamento confirmado com sucesso.");
    setItems([]);
    setInvoiceNumber("");
    setReceipts([]);
    setAiHighlightKeys(new Set());
    onAfterConfirm?.();
    setTimeout(() => setToast(""), 2600);
  }, [token, items, supplierId, date, invoiceNumber, receipts, onAfterConfirm]);

  const parseReceiptsByAI = useCallback(
    async (opts = {}) => {
      const { onSuccess } = opts;
      if (!receipts.length) return false;
      setAiLoading(true);
      setAiMissing([]);
      try {
        const form = new FormData();
        for (const file of receipts) form.append("receipts", file);
        const { data } = await api.post("/purchases/receipt-ai-parse", form, {
          headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" }
        });

        const inv = invoiceNumberFromAi(data?.invoiceNumber);
        if (inv) setInvoiceNumber(inv);

        if (data?.purchaseDate) setDate(String(data.purchaseDate).slice(0, 10));

        if (data?.supplierSuggestion?.id) setSupplierId(String(data.supplierSuggestion.id));

        const fromApi = data?.items || [];
        const singleLineInvoice = fromApi.length === 1;
        const autoItems = fromApi.map((row) => buildItemRowFromAi(row, { singleLineInvoice })).filter(Boolean);
        if (autoItems.length) setItems(autoItems);

        const firstIncomplete = fromApi.find((it) => {
          const priceOk = it.unitPrice != null && Number(it.unitPrice) > 0;
          return priceOk && !it.productId;
        });
        if (firstIncomplete) {
          const q =
            firstIncomplete.quantity != null && Number(firstIncomplete.quantity) > 0
              ? String(firstIncomplete.quantity)
              : "1";
          const p = firstIncomplete.unitPrice != null ? String(firstIncomplete.unitPrice) : "";
          setDraftItem({
            productId: "",
            quantity: q,
            unitUsed:
              firstIncomplete.unitUsed && ["kg", "un", "cx", "L", "l", "g", "ml"].includes(String(firstIncomplete.unitUsed))
                ? firstIncomplete.unitUsed === "l"
                  ? "L"
                  : firstIncomplete.unitUsed
                : "un",
            unitPrice: p,
            lineType: firstIncomplete.lineType === "venda" ? "venda" : "insumo"
          });
        } else if (autoItems.length) {
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
          autoItems.forEach((_, idx) => keys.add(`item.${idx}`));
          setAiHighlightKeys(keys);
        }

        if (onSuccess) {
          onSuccess(data, {
            autoItems,
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
        setAiMissing([err?.response?.data?.message || "Não foi possível ler a nota com IA."]);
        if (recordAiHighlights) setAiHighlightKeys(new Set());
        return false;
      } finally {
        setAiLoading(false);
      }
    },
    [token, receipts, recordAiHighlights]
  );

  return {
    overview,
    suppliers,
    products,
    date,
    setDate,
    supplierId,
    setSupplierId,
    invoiceNumber,
    setInvoiceNumber,
    receipts,
    setReceipts,
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
    clearItemRowAiHighlight
  };
}
