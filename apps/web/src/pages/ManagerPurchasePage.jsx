import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaCheck, FaFileInvoice, FaShoppingBasket } from "react-icons/fa";
import AppShell from "../components/AppShell";
import FilePickButton from "../components/ui/FilePickButton";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { useAuth } from "../auth/AuthProvider";
import CompactTable from "../components/ui/CompactTable";
import SingleSelectInput from "../components/ui/SingleSelectInput";
import SingleSelectSearch from "../components/ui/SingleSelectSearch";
import UnitSelect from "../components/ui/UnitSelect";
import { formatStoreReadonly } from "../lib/displayText";
import { formatCurrency } from "../lib/formatters";
import { usePurchaseForm } from "../hooks/usePurchaseForm";

const STEPS = [
  { n: 1, title: "Dados da compra", hint: "Data, fornecedor e anexo da nota" },
  { n: 2, title: "Itens da nota", hint: "Produtos, valores e insumo ou venda" },
  { n: 3, title: "Nota fiscal", hint: "Número NF e arquivos" },
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
    items,
    draftItem,
    setDraftItem,
    toast,
    total,
    addItem,
    updateItem,
    confirmPurchase,
    createSupplier,
    supplierCreating,
    createProduct,
    productCreating
  } = usePurchaseForm(token, { recordAiHighlights: false, onAfterConfirm });

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

  const lojaReadonly = formatStoreReadonly(overview, user);

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
                . Nesta página o fluxo é manual por etapas: preencha os campos e anexe a nota antes de confirmar.
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
                  <span className="field-helper">A IA na página Compra com IA pode sugerir este número; aqui pode editar à mão.</span>
                </div>
                <div className="field field-wizard">
                  <label>Fotos / PDF da nota (obrigatório  ·  mínimo 1 arquivo)</label>
                  <FilePickButton
                    buttonText="Escolher arquivo(s) da nota"
                    multiple
                    onFilesSelected={(files) => setReceipts(files)}
                    helper={
                      receipts.length
                        ? `${receipts.length} arquivo(s): ${receipts.map((f) => f.name).join(", ")}`
                        : "Selecione uma ou várias imagens/PDF da nota. Sem anexo não é possível confirmar o lançamento."
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="wizard-step-content">
              <div className="wizard-section-icon">
                <FaShoppingBasket />
              </div>
              <h3 className="wizard-panel-title">Itens da nota fiscal</h3>
              <p className="wizard-panel-desc">Busque o produto, escolha a categoria, informe quantidade e valor. Marque se a linha é insumo ou venda.</p>

              <div className="grid wizard-item-grid">
                <div className="span-5 wizard-product-col wizard-product-card">
                  <SingleSelectSearch
                    label="Produto"
                    placeholder="Digite para buscar ou adicionar…"
                    options={products.map((product) => ({ value: product.id, label: product.name }))}
                    value={draftItem.productId}
                    onChange={(id) => pickDraftProduct(id)}
                    allowCreate
                    createEntityLabel="produto"
                    createBusy={productCreating}
                    onCreateOption={async (q) => {
                      const data = await createProduct(q, draftItem.lineType, draftItem.category);
                      if (!data) return;
                      pickDraftProduct(data.id);
                    }}
                  />
                  <SingleSelectInput
                    label="Categoria"
                    placeholder="Digite para buscar ou criar…"
                    options={categoryOptions}
                    value={draftItem.category}
                    onChange={(next) => setDraftItem({ ...draftItem, category: next })}
                  />
                  <div className="purchase-line-type-block purchase-line-type-block--nested">
                    <span className="purchase-line-type-label">Esta linha é insumo ou venda?</span>
                    <div className="purchase-line-type-options" role="radiogroup" aria-label="Insumo ou venda (nova linha)">
                      <label className="purchase-line-type-option">
                        <input
                          type="radio"
                          name="draft-line-type"
                          checked={draftItem.lineType === "insumo"}
                          onChange={() => setDraftItem({ ...draftItem, lineType: "insumo" })}
                        />
                        <span>Insumo</span>
                      </label>
                      <label className="purchase-line-type-option">
                        <input
                          type="radio"
                          name="draft-line-type"
                          checked={draftItem.lineType === "venda"}
                          onChange={() => setDraftItem({ ...draftItem, lineType: "venda" })}
                        />
                        <span>Venda</span>
                      </label>
                    </div>
                    <p className="field-helper">Cada item da nota pode ser diferente; o cadastro do produto só sugere o padrão.</p>
                  </div>
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
                  <UnitSelect
                    value={draftItem.unitUsed}
                    units={unitOptions}
                    products={products}
                    onChange={(e) => setDraftItem({ ...draftItem, unitUsed: e.target.value })}
                  />
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

              <CompactTable
                columns={[
                  {
                    id: "productId",
                    label: "Produto",
                    getTitle: (item) => products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || "",
                    render: (item) => products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || "n/d"
                  },
                  {
                    id: "category",
                    label: "Categoria",
                    render: (item, idx) => (
                      <SingleSelectInput
                        placeholder="Categoria…"
                        options={categoryOptions}
                        value={item.category || ""}
                        onChange={(next) => updateItem(idx, { category: next })}
                      />
                    )
                  },
                  {
                    id: "lineType",
                    label: "Insumo / venda",
                    render: (item, idx) => (
                      <div
                        className="purchase-line-type-options purchase-line-type-options--compact"
                        role="radiogroup"
                        aria-label={`Tipo do item ${idx + 1}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="purchase-line-type-option">
                          <input
                            type="radio"
                            name={`wizard-item-line-${idx}`}
                            checked={item.lineType !== "venda"}
                            onChange={() => updateItem(idx, { lineType: "insumo" })}
                          />
                          <span>Insumo</span>
                        </label>
                        <label className="purchase-line-type-option">
                          <input
                            type="radio"
                            name={`wizard-item-line-${idx}`}
                            checked={item.lineType === "venda"}
                            onChange={() => updateItem(idx, { lineType: "venda" })}
                          />
                          <span>Venda</span>
                        </label>
                      </div>
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
                  <label>Arquivo da nota (obrigatório  ·  mínimo 1 arquivo)</label>
                  <FilePickButton
                    buttonText="Escolher arquivo(s) da nota"
                    multiple
                    onFilesSelected={(files) => setReceipts(files)}
                    helper={
                      receipts.length
                        ? `${receipts.length} arquivo(s): ${receipts.map((f) => f.name).join(", ")}`
                        : "JPG, PNG ou PDF. Mínimo 1 arquivo obrigatório para confirmar."
                    }
                  />
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
                  <dd>{suppliers.find((s) => s.id === supplierId)?.name || "n/d"}</dd>
                </div>
                <div>
                  <dt>Data da compra</dt>
                  <dd>{date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") : "n/d"}</dd>
                </div>
                <div>
                  <dt>Loja</dt>
                  <dd>
                    {overview?.storeCode != null
                      ? `${overview.storeCode}  ·  ${overview.storeName ?? "n/d"}`
                      : overview === undefined
                        ? "…"
                        : "n/d"}
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
                  <li key={`${item.productId || "pending"}-${idx}`}>
                    <strong>{products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || item.productId || "n/d"}</strong>
                    <span className="wizard-review-meta">
                      {item.category || products.find((p) => p.id === item.productId)?.category || "n/d"} ·{" "}
                      {item.lineType === "venda" ? "Venda" : "Insumo"} · {item.quantity} {item.unitUsed} ×{" "}
                      {formatCurrency(item.unitPrice)}
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
