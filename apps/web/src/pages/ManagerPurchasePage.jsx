import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaCheck, FaFileInvoice, FaRobot, FaShoppingBasket } from "react-icons/fa";
import AppShell from "../components/AppShell";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { useAuth } from "../auth/AuthProvider";
import CompactTable from "../components/ui/CompactTable";
import SingleSelectSearch from "../components/ui/SingleSelectSearch";
import { formatCurrency } from "../lib/formatters";
import { usePurchaseForm } from "../hooks/usePurchaseForm";

const STEPS = [
  { n: 1, title: "Dados da compra", hint: "Data, fornecedor, nº NF, anexo e IA" },
  { n: 2, title: "Itens da nota", hint: "Produtos, valores e insumo ou venda" },
  { n: 3, title: "Nota fiscal", hint: "Número NF, arquivo e leitura por IA" },
  { n: 4, title: "Conferir e enviar", hint: "Revise tudo antes de salvar" }
];

export default function ManagerPurchasePage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const onAfterConfirm = useCallback(() => setStep(1), []);

  const {
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
    draftItem,
    setDraftItem,
    toast,
    aiLoading,
    aiMissing,
    total,
    addItem,
    confirmPurchase,
    parseReceiptsByAI,
    createSupplier,
    supplierCreating
  } = usePurchaseForm(token, { recordAiHighlights: false, onAfterConfirm });

  const handleParseAi = useCallback(() => {
    parseReceiptsByAI({
      onSuccess: (data, { autoItems }) => {
        const canReviewItems = autoItems.length > 0 && Boolean(data?.purchaseDate);
        if (canReviewItems) setStep(2);
        else setStep(1);
      }
    });
  }, [parseReceiptsByAI]);

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
                Para análise com IA numa única página (upload, leitura automática e formulário completo), use{" "}
                <button type="button" className="btn btn-link" style={{ padding: 0, verticalAlign: "baseline" }} onClick={() => navigate("/manager/new-purchase/ai")}>
                  Compra com IA
                </button>
                . Aqui pode continuar por etapas: anexe a nota e use &quot;Ler nota com IA&quot; nesta página, ou preencha à mão.
              </p>
              <div className="wizard-fields">
                <div className="field field-wizard">
                  <label>Data da compra</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field field-wizard field-wizard-supplier">
                  <SingleSelectSearch
                    label="Fornecedor"
                    placeholder="Digite para buscar ou adicionar…"
                    options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                    value={supplierId}
                    onChange={setSupplierId}
                    allowCreate
                    createBusy={supplierCreating}
                    onCreateOption={createSupplier}
                  />
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
                <div className="field field-wizard wizard-ai-actions">
                  <label>&nbsp;</label>
                  <div className="wizard-ai-btn-row">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => navigate("/manager/new-purchase/ai")}
                    >
                      <FaRobot style={{ marginRight: "0.35rem" }} />
                      Analisar com IA
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={handleParseAi} disabled={!receipts.length || aiLoading}>
                      <FaRobot style={{ marginRight: "0.35rem" }} />
                      {aiLoading ? "Lendo nota..." : "Ler nota com IA (aqui)"}
                    </button>
                  </div>
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
                  { id: "productId", label: "Produto", render: (item) => products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || "—" },
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
