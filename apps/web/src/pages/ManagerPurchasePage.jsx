import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaCheck, FaFileInvoice, FaRobot, FaShoppingBasket } from "react-icons/fa";
import AppShell from "../components/AppShell";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { api, withAuth } from "../api";
import { useAuth } from "../auth/AuthProvider";
import CompactTable from "../components/ui/CompactTable";
import SingleSelectSearch from "../components/ui/SingleSelectSearch";
import { formatCurrency } from "../lib/formatters";
import { mockProducts, mockSuppliers } from "../mocks/mockData";

function toWeekOfMonth(dateStr) {
  const date = new Date(dateStr);
  return Math.ceil(date.getDate() / 7);
}

/** Normaliza número da NF vindo da IA (pode ser número ou string). */
function invoiceNumberFromAi(value) {
  if (value == null) return "";
  const s = String(value).trim();
  return s || "";
}

const STEPS = [
  { n: 1, title: "Dados da compra", hint: "Data, fornecedor, nº NF, anexo e IA" },
  { n: 2, title: "Itens da nota", hint: "Produtos, valores e insumo ou venda" },
  { n: 3, title: "Nota fiscal", hint: "Número NF, arquivo e leitura por IA" },
  { n: 4, title: "Conferir e enviar", hint: "Revise tudo antes de salvar" }
];

export default function ManagerPurchasePage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(undefined);
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get("/catalog/suppliers", withAuth(token)),
      api.get("/catalog/products", withAuth(token)),
      api.get("/manager/overview", withAuth(token))
    ]).then(([supRes, prodRes, ovRes]) => {
      setSuppliers(supRes.data?.length ? supRes.data : mockSuppliers);
      setProducts(prodRes.data?.length ? prodRes.data : mockProducts);
      setOverview(ovRes.data ?? null);
    });
  }, [token]);

  const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);

  function addItem() {
    if (!draftItem.productId || !draftItem.quantity || !draftItem.unitPrice) return;
    setItems([...items, { ...draftItem }]);
    setDraftItem({ productId: "", quantity: "", unitUsed: "kg", unitPrice: "", lineType: "insumo" });
  }

  async function confirmPurchase() {
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
    setStep(1);
    setTimeout(() => setToast(""), 2600);
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
      unitUsed: it.unitUsed && ["kg", "un", "cx", "L", "l", "g", "ml"].includes(String(it.unitUsed)) ? (it.unitUsed === "l" ? "L" : it.unitUsed) : "un",
      unitPrice: String(priceNum),
      lineType: it.lineType === "venda" ? "venda" : "insumo"
    };
  }

  async function parseReceiptsByAI() {
    if (!receipts.length) return;
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
        const q = firstIncomplete.quantity != null && Number(firstIncomplete.quantity) > 0 ? String(firstIncomplete.quantity) : "1";
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

      const suggestedSupplier = Boolean(data?.supplierSuggestion?.id);
      const canReviewItems = autoItems.length > 0 && suggestedSupplier && data?.purchaseDate;
      if (canReviewItems) setStep(2);
      else setStep(1);

      if (!missingRows.length) {
        setToast("Leitura concluída. Revise os dados nas etapas e confirme ou ajuste o que precisar.");
        setTimeout(() => setToast(""), 3200);
      } else {
        setToast("IA sugeriu parte dos dados. Complete ou corrija os campos indicados abaixo.");
        setTimeout(() => setToast(""), 3800);
      }
    } catch (err) {
      setAiMissing([err?.response?.data?.message || "Não foi possível ler a nota com IA."]);
    } finally {
      setAiLoading(false);
    }
  }

  const links = useMemo(() => buildManagerSidebarLinks(navigate), [navigate]);

  const canGoNext =
    step === 1
      ? Boolean(supplierId)
      : step === 2
        ? items.length > 0
        : step === 3
          ? receipts.length > 0
          : false;

  const storeBadge =
    overview?.storeCode != null && String(overview.storeCode).length
      ? `Loja ${overview.storeCode}${overview.storeName ? ` · ${overview.storeName}` : ""}`
      : null;

  const lojaReadonly =
    overview === undefined
      ? "Carregando…"
      : overview?.storeCode != null
        ? `Código ${overview.storeCode} — ${overview.storeName ?? "Sua loja"}`
        : user?.storeId
          ? "Loja vinculada ao seu acesso"
          : "—";

  return (
    <AppShell
      title="Lançar compra"
      subtitle="Registre compras da sua unidade com clareza"
      links={links}
      activeLinkKey="new-purchase"
      storeBadge={storeBadge}
    >
      <div className="purchase-wizard">
        <header className="wizard-header">
          <h2 className="wizard-title">Novo lançamento</h2>
          <p className="wizard-lead">Quatro etapas rápidas. Use Voltar se precisar corrigir algo.</p>
        </header>

        <ol className="wizard-steps" aria-label="Etapas">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className={`wizard-step ${step === s.n ? "wizard-step-active" : ""} ${step > s.n ? "wizard-step-done" : ""}`}
            >
              <span className="wizard-step-num" aria-hidden>
                {step > s.n ? <FaCheck /> : s.n}
              </span>
              <span className="wizard-step-body">
                <span className="wizard-step-title">{s.title}</span>
                <span className="wizard-step-hint">{s.hint}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="wizard-panel card">
          {step === 1 ? (
            <div className="wizard-step-content">
              <h3 className="wizard-panel-title">Quem fornece e quando</h3>
              <p className="wizard-panel-desc">
                Anexe fotos ou PDF da nota e use &quot;Ler nota com IA&quot;. A IA preenche automaticamente data, fornecedor, número da NF e itens
                quando reconhecer; revê e edita qualquer campo antes de avançar.
              </p>
              <div className="wizard-fields">
                <div className="field field-wizard">
                  <label>Data da compra</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field field-wizard">
                  <label>Fornecedor</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Selecione o fornecedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field field-wizard">
                  <label>Número da nota fiscal</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex.: 12345 ou chave resumida"
                    autoComplete="off"
                  />
                  <span className="field-helper">A IA tenta preencher a partir da nota; pode editar.</span>
                </div>
                <div className="field field-wizard">
                  <label>Fotos / PDF da nota (obrigatório)</label>
                  <input
                    className="wizard-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                    onChange={(e) => setReceipts(Array.from(e.target.files || []))}
                  />
                  <span className="field-helper">
                    {receipts.length
                      ? `${receipts.length} arquivo(s): ${receipts.map((f) => f.name).join(", ")}`
                      : "Selecione uma ou várias imagens/PDF da nota"}
                  </span>
                </div>
                <div className="field field-wizard">
                  <label>&nbsp;</label>
                  <button className="btn btn-primary" type="button" onClick={parseReceiptsByAI} disabled={!receipts.length || aiLoading}>
                    <FaRobot style={{ marginRight: "0.35rem" }} />
                    {aiLoading ? "Lendo nota..." : "Ler nota com IA"}
                  </button>
                </div>
              </div>
              {aiMissing.length ? (
                <div className="card" style={{ marginTop: "0.75rem", borderTop: 0 }}>
                  <h4 style={{ marginBottom: "0.5rem" }}>Ajustes sugeridos (revise o formulário acima e nas etapas seguintes)</h4>
                  <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                    {aiMissing.map((msg, idx) => (
                      <li key={`${msg}-${idx}`}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="wizard-step-content">
              <div className="wizard-section-icon">
                <FaShoppingBasket />
              </div>
              <h3 className="wizard-panel-title">Itens da nota fiscal</h3>
              <p className="wizard-panel-desc">Busque o produto, informe quantidade e valor. Marque se a linha é insumo ou venda.</p>

              <div className="grid wizard-item-grid">
                <div className="span-5 wizard-product-col">
                  <SingleSelectSearch
                    label="Produto"
                    placeholder="Digite para buscar..."
                    options={products.map((product) => ({ value: product.id, label: product.name }))}
                    value={draftItem.productId}
                    onChange={(id) => {
                      const product = products.find((p) => p.id === id);
                      const suggestion = product?.type === "venda" ? "venda" : "insumo";
                      setDraftItem({ ...draftItem, productId: id, lineType: suggestion });
                    }}
                  />
                </div>
                <div className="field span-2 field-wizard">
                  <label>Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={draftItem.quantity}
                    onChange={(e) => setDraftItem({ ...draftItem, quantity: e.target.value })}
                  />
                </div>
                <div className="field span-2 field-wizard">
                  <label>Unidade</label>
                  <select value={draftItem.unitUsed} onChange={(e) => setDraftItem({ ...draftItem, unitUsed: e.target.value })}>
                    <option value="kg">kg</option>
                    <option value="un">un</option>
                    <option value="cx">cx</option>
                    <option value="L">L</option>
                  </select>
                </div>
                <div className="field span-2 field-wizard">
                  <label>Valor unitário (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftItem.unitPrice}
                    onChange={(e) => setDraftItem({ ...draftItem, unitPrice: e.target.value })}
                  />
                </div>
                <div className="span-1 field-wizard wizard-add-btn-wrap">
                  <label className="wizard-label-spacer">&nbsp;</label>
                  <button className="btn btn-secondary btn-block" type="button" onClick={addItem}>
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="purchase-line-type-block">
                <span className="purchase-line-type-label">Esta linha é insumo ou venda?</span>
                <div className="purchase-line-type-options" role="radiogroup" aria-label="Insumo ou venda">
                  <label className="purchase-line-type-option">
                    <input
                      type="radio"
                      name="draft-line-type"
                      checked={draftItem.lineType === "insumo"}
                      onChange={() => setDraftItem({ ...draftItem, lineType: "insumo" })}
                    />
                    <span>Insumo (produção / uso interno)</span>
                  </label>
                  <label className="purchase-line-type-option">
                    <input
                      type="radio"
                      name="draft-line-type"
                      checked={draftItem.lineType === "venda"}
                      onChange={() => setDraftItem({ ...draftItem, lineType: "venda" })}
                    />
                    <span>Venda (revenda)</span>
                  </label>
                </div>
                <p className="field-helper">O sistema sugere conforme o cadastro do produto; você pode alterar antes de adicionar.</p>
              </div>

              <CompactTable
                columns={[
                  { id: "productId", label: "Produto", render: (item) => products.find((p) => p.id === item.productId)?.name || item.productId },
                  {
                    id: "lineType",
                    label: "Tipo",
                    render: (item) => (
                      <span className={item.lineType === "venda" ? "badge badge-warning" : "badge badge-info"}>
                        {item.lineType === "venda" ? "Venda" : "Insumo"}
                      </span>
                    )
                  },
                  { id: "quantity", label: "Qtd" },
                  { id: "unitUsed", label: "Unid." },
                  { id: "unitPrice", label: "Valor un.", render: (item) => formatCurrency(item.unitPrice) },
                  {
                    id: "lineTotal",
                    label: "Total",
                    render: (item) => formatCurrency(Number(item.quantity) * Number(item.unitPrice))
                  }
                ]}
                rows={items}
                loading={false}
                emptyMessage="Nenhum item ainda. Preencha acima e clique em “Adicionar à lista”."
              />
              <p className="wizard-total">
                Total desta nota: <strong>{formatCurrency(total)}</strong>
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="wizard-step-content">
              <div className="wizard-section-icon">
                <FaFileInvoice />
              </div>
              <h3 className="wizard-panel-title">Nota fiscal</h3>
              <p className="wizard-panel-desc">Confira número e arquivos da nota antes de concluir.</p>
              <div className="wizard-fields">
                <div className="field field-wizard">
                  <label>Número da nota fiscal</label>
                  <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex.: 12345" />
                </div>
                <div className="field field-wizard">
                  <label>Arquivo da nota (obrigatório)</label>
                  <input
                    className="wizard-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                    onChange={(e) => setReceipts(Array.from(e.target.files || []))}
                  />
                  <span className="field-helper">
                    {receipts.length
                      ? `${receipts.length} arquivo(s): ${receipts.map((f) => f.name).join(", ")}`
                      : "JPG, PNG ou PDF até 7 MB por arquivo"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="wizard-step-content wizard-review">
              <div className="wizard-section-icon wizard-section-icon-success">
                <FaCheck />
              </div>
              <h3 className="wizard-panel-title">Conferência final</h3>
              <p className="wizard-panel-desc">Confira os dados antes de salvar no sistema.</p>

              <dl className="wizard-review-dl">
                <div>
                  <dt>Fornecedor</dt>
                  <dd>{suppliers.find((s) => s.id === supplierId)?.name || "—"}</dd>
                </div>
                <div>
                  <dt>Data da compra</dt>
                  <dd>{date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</dd>
                </div>
                <div>
                  <dt>Loja</dt>
                  <dd>
                    {overview?.storeCode != null
                      ? `${overview.storeCode} — ${overview.storeName ?? "—"}`
                      : overview === undefined
                        ? "…"
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatCurrency(total)}</dd>
                </div>
                <div>
                  <dt>Nota fiscal</dt>
                  <dd>{invoiceNumber || "Será gerada ao confirmar"}</dd>
                </div>
                <div>
                  <dt>Anexo</dt>
                  <dd>{receipts.length ? `${receipts.length} arquivo(s)` : "Sem arquivo"}</dd>
                </div>
              </dl>

              <h4 className="wizard-review-sub">Itens</h4>
              <ul className="purchase-review-list">
                {items.map((item, idx) => (
                  <li key={`${item.productId}-${idx}`}>
                    <strong>{products.find((p) => p.id === item.productId)?.name || item.productId}</strong>
                    <span className="wizard-review-meta">
                      {item.lineType === "venda" ? "Venda" : "Insumo"} · {item.quantity} {item.unitUsed} × {formatCurrency(item.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="wizard-footer">
          <button className="btn btn-ghost" type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            <FaArrowLeft style={{ marginRight: "0.35rem" }} />
            Voltar
          </button>
          {step < 4 ? (
            <button className="btn btn-primary" type="button" disabled={!canGoNext} onClick={() => setStep((s) => s + 1)}>
              Próximo
              <FaArrowRight style={{ marginLeft: "0.35rem" }} />
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={confirmPurchase} disabled={!supplierId || !items.length || !receipts.length}>
              Confirmar lançamento
            </button>
          )}
        </footer>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </AppShell>
  );
}
