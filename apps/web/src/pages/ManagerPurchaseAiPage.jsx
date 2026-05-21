import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaStore, FaTimes, FaTrash } from "react-icons/fa";
import { MdAutoAwesome } from "react-icons/md";
import AppShell from "../components/AppShell";
import ReceiptAiDropzoneCard from "../components/purchase/ReceiptAiDropzoneCard";
import ReceiptAiProgressPanel from "../components/purchase/ReceiptAiProgressPanel";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { useAuth } from "../auth/AuthProvider";
import FilePickButton from "../components/ui/FilePickButton";
import SingleSelectInput from "../components/ui/SingleSelectInput";
import SingleSelectSearch from "../components/ui/SingleSelectSearch";
import UnitSelect from "../components/ui/UnitSelect";
import { buildReceiptTotalDifferenceRows, formatStoreReadonly } from "../lib/displayText";
import { formatCurrency } from "../lib/formatters";
import { usePurchaseForm } from "../hooks/usePurchaseForm";

export default function ManagerPurchaseAiPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const lastAnalyzedSigRef = useRef("");

  const onAfterConfirm = useCallback(() => {
    navigate("/manager");
  }, [navigate]);

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
    appendReceipts,
    removeReceiptAt,
    clearReceipts,
    receiptExtras,
    appendReceiptExtras,
    removeReceiptExtraAt,
    items,
    draftItem,
    setDraftItem,
    toast,
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
    aiHighlightKeys,
    clearAiHighlight,
    clearItemRowAiHighlight,
    createSupplier,
    supplierCreating,
    createProduct,
    productCreating
  } = usePurchaseForm(token, { recordAiHighlights: true, onAfterConfirm });

  const handleAppendReceipts = useCallback(
    (files) => {
      lastAnalyzedSigRef.current = "";
      appendReceipts(files);
    },
    [appendReceipts]
  );

  const handleRemoveReceipt = useCallback(
    (index) => {
      lastAnalyzedSigRef.current = "";
      removeReceiptAt(index);
    },
    [removeReceiptAt]
  );

  const handleClearReceipts = useCallback(() => {
    lastAnalyzedSigRef.current = "";
    clearReceipts();
  }, [clearReceipts]);

  const handleAnalyzeReceipts = useCallback(() => {
    if (!receipts.length || aiLoading || parseInFlightRef.current) return;
    const sig = receipts.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|");
    if (sig === lastAnalyzedSigRef.current) return;
    lastAnalyzedSigRef.current = sig;
    parseInFlightRef.current = true;
    void (async () => {
      const ok = await parseReceiptsByAI({ onSuccess: () => {} });
      parseInFlightRef.current = false;
      if (!ok) lastAnalyzedSigRef.current = "";
    })();
  }, [receipts, aiLoading, parseReceiptsByAI]);

  const handleOptionalReceiptChange = useCallback(
    (list) => {
      if (!list?.length) return;
      appendReceiptExtras(list);
    },
    [appendReceiptExtras]
  );

  const parseInFlightRef = useRef(false);

  const links = useMemo(() => buildManagerSidebarLinks(navigate), [navigate]);

  const storeBadge =
    overview?.storeCode != null && String(overview.storeCode).length
      ? `Loja ${overview.storeCode}${overview.storeName ? ` · ${overview.storeName}` : ""}`
      : null;

  const lojaReadonly = formatStoreReadonly(overview, user);

  const aiClass = (key) => (aiHighlightKeys?.has(key) ? "field-ai-suggested" : "");

  const docTotalRows = useMemo(
    () => buildReceiptTotalDifferenceRows(documentTotals, formatCurrency),
    [documentTotals]
  );

  return (
    <AppShell
      title="Compra com IA"
      subtitle="Envie a nota, revise o formulário preenchido automaticamente e registe"
      links={links}
      activeLinkKey="purchase-ai"
      storeBadge={storeBadge}
    >
      <div className="purchase-ai-page">
        <button type="button" className="btn btn-ghost purchase-ai-back" onClick={() => navigate("/manager/new-purchase")}>
          <FaArrowLeft style={{ marginRight: "0.35rem" }} />
          Fluxo por etapas
        </button>

        <div className="purchase-ai-inner">
          <ReceiptAiDropzoneCard
            disabled={!token}
            analyzing={aiLoading}
            receipts={receipts}
            onAppendFiles={handleAppendReceipts}
            onRemoveFile={handleRemoveReceipt}
            onClearFiles={handleClearReceipts}
            onAnalyze={handleAnalyzeReceipts}
          />

          <ReceiptAiProgressPanel
            visible={aiLoading}
            stage={aiStage}
            progress={aiProgress}
            message={aiStatusMessage}
            error={!aiLoading ? aiError : ""}
            retryCount={aiRetryCount}
            onRetry={
              aiError && receipts.length
                ? () => {
                    lastAnalyzedSigRef.current = "";
                    void retryAiParse();
                  }
                : undefined
            }
          />

          <div className="card purchase-ai-optional-receipt">
            <p className="purchase-ai-optional-label">Anexo adicional (opcional)</p>
            <p className="field-helper purchase-ai-optional-hint">
              Outros PDFs ou imagens que devam ficar no registro (ex.: verso, complemento). Não entram na leitura por IA; use o
              cartão acima para fotos da nota e o botão <strong>Analisar com IA</strong>.
            </p>
            <FilePickButton
              className="file-pick--full"
              buttonText="Adicionar anexo opcional"
              multiple
              disabled={!token || aiLoading}
              onFilesSelected={handleOptionalReceiptChange}
              helper={
                receiptExtras.length
                  ? `${receiptExtras.length} anexo(s) extra: ${receiptExtras.map((f) => f.name).join(", ")}`
                  : "Nenhum anexo extra selecionado."
              }
            />
            {receiptExtras.length > 0 ? (
              <ul className="purchase-ai-extra-list" aria-label="Anexos extras">
                {receiptExtras.map((f, i) => (
                  <li key={`${f.name}-${f.size}-${f.lastModified}-${i}`}>
                    <span className="purchase-ai-extra-name">{f.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      title="Remover anexo"
                      onClick={() => removeReceiptExtraAt(i)}
                    >
                      <FaTimes aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={`purchase-ai-form-wrap ${aiLoading ? "purchase-ai-form-busy" : ""}`} aria-busy={aiLoading}>
            <section className="card purchase-ai-section">
              <h3 className="purchase-ai-section-title">
                <FaStore className="purchase-ai-section-icon" aria-hidden />
                Dados da compra
              </h3>
              <div className="purchase-ai-grid">
                <div className={`field purchase-ai-field ${aiClass("date")}`}>
                  <label htmlFor="purchase-ai-date">Data da compra</label>
                  <input
                    id="purchase-ai-date"
                    type="date"
                    className="purchase-ai-input"
                    value={date}
                    onChange={(e) => {
                      clearAiHighlight("date");
                      setDate(e.target.value);
                    }}
                  />
                </div>
                <div className={`field purchase-ai-field span-2 ${aiClass("supplierId")}`}>
                  <SingleSelectSearch
                    label="Fornecedor"
                    placeholder="Digite para buscar ou adicionar…"
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    value={supplierId}
                    onChange={(id) => {
                      clearAiHighlight("supplierId");
                      setSupplierId(id);
                    }}
                    allowCreate
                    createBusy={supplierCreating}
                    onCreateOption={createSupplier}
                    inputClassName="purchase-ai-input"
                  />
                </div>
                <div className={`field purchase-ai-field span-2 ${aiClass("invoiceNumber")}`}>
                  <label htmlFor="purchase-ai-invoice">Número da nota fiscal</label>
                  <input
                    id="purchase-ai-invoice"
                    type="text"
                    className="purchase-ai-input"
                    value={invoiceNumber}
                    placeholder="Ex.: COO, número NF-e, etc."
                    autoComplete="off"
                    onChange={(e) => {
                      clearAiHighlight("invoiceNumber");
                      setInvoiceNumber(e.target.value);
                    }}
                  />
                </div>
                <div className="field purchase-ai-field span-2">
                  <label>Loja</label>
                  <input className="purchase-ai-input" readOnly value={lojaReadonly} />
                </div>
              </div>
            </section>

            <section className="card purchase-ai-section">
              <h3 className="purchase-ai-section-title">
                <MdAutoAwesome className="purchase-ai-section-icon" aria-hidden />
                Itens da nota
              </h3>
              <p className="purchase-ai-section-desc">
                Cada linha corresponde a um produto. Confirme a categoria e complete o que a IA não tiver identificado.
              </p>

              {items.length === 0 ? (
                <p className="purchase-ai-empty-items">Nenhum item ainda. Após a análise da nota, as linhas aparecem aqui; pode também adicionar linhas manualmente.</p>
              ) : (
                <ul className="purchase-ai-item-list">
                  {items.map((row, idx) => (
                    <li key={`line-${idx}`} className={`purchase-ai-item-row card ${aiHighlightKeys?.has(`item.${idx}`) ? "purchase-ai-item-suggested" : ""}`}>
                      <div className="purchase-ai-item-grid">
                        <div className="purchase-ai-item-product">
                          <SingleSelectInput
                            label="Categoria"
                            placeholder="Digite para buscar ou criar…"
                            options={categoryOptions}
                            value={row.category || ""}
                            onChange={(next) => {
                              clearItemRowAiHighlight(idx);
                              updateItem(idx, { category: next });
                            }}
                            createEntityLabel="categoria"
                          />
                          <SingleSelectSearch
                            label="Produto"
                            placeholder="Buscar ou adicionar produto…"
                            options={products.map((p) => ({ value: p.id, label: p.name }))}
                            value={row.productId}
                            onChange={(id) => {
                              clearItemRowAiHighlight(idx);
                              const product = products.find((p) => p.id === id);
                              const suggestion = product?.type === "venda" ? "venda" : "insumo";
                              updateItem(idx, {
                                productId: id,
                                lineType: suggestion,
                                category: product?.category ? String(product.category) : row.category,
                                aiRawProductName: undefined
                              });
                            }}
                            allowCreate
                            createEntityLabel="produto"
                            createBusy={productCreating}
                            onCreateOption={async (q) => {
                              const data = await createProduct(q, row.lineType, row.category);
                              if (!data) return;
                              const suggestion = data.type === "venda" ? "venda" : "insumo";
                              updateItem(idx, {
                                productId: data.id,
                                lineType: suggestion,
                                category: data.category ? String(data.category) : row.category,
                                aiRawProductName: undefined
                              });
                            }}
                            inputClassName="purchase-ai-input"
                          />
                          <div className="purchase-ai-product-line-type">
                            <span className="purchase-ai-mini-label">Insumo ou venda (esta linha)</span>
                            <div className="purchase-line-type-options" role="radiogroup" aria-label={`Insumo ou venda linha ${idx + 1}`}>
                              <label className="purchase-line-type-option">
                                <input
                                  type="radio"
                                  name={`line-type-${idx}`}
                                  checked={row.lineType === "insumo"}
                                  onChange={() => {
                                    clearItemRowAiHighlight(idx);
                                    updateItem(idx, { lineType: "insumo" });
                                  }}
                                />
                                <span>Insumo</span>
                              </label>
                              <label className="purchase-line-type-option">
                                <input
                                  type="radio"
                                  name={`line-type-${idx}`}
                                  checked={row.lineType === "venda"}
                                  onChange={() => {
                                    clearItemRowAiHighlight(idx);
                                    updateItem(idx, { lineType: "venda" });
                                  }}
                                />
                                <span>Venda</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="field purchase-ai-field">
                          <label>Quantidade</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="purchase-ai-input"
                            value={row.quantity}
                            onChange={(e) => {
                              clearItemRowAiHighlight(idx);
                              updateItem(idx, { quantity: e.target.value });
                            }}
                          />
                        </div>
                        <div className="field purchase-ai-field">
                          <label>Unidade</label>
                          <UnitSelect
                            className="purchase-ai-input"
                            value={row.unitUsed}
                            units={unitOptions}
                            products={products}
                            onChange={(e) => {
                              clearItemRowAiHighlight(idx);
                              updateItem(idx, { unitUsed: e.target.value });
                            }}
                          />
                        </div>
                        <div className="field purchase-ai-field">
                          <label>Valor unit. (R$)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="purchase-ai-input"
                            value={row.unitPrice}
                            onChange={(e) => {
                              clearItemRowAiHighlight(idx);
                              updateItem(idx, { unitPrice: e.target.value });
                            }}
                          />
                          {row.aiLineTotal != null ? (
                            <span className="field-helper">Total na nota: {formatCurrency(row.aiLineTotal)}</span>
                          ) : null}
                        </div>
                        <div className="purchase-ai-item-actions">
                          <button type="button" className="btn btn-ghost btn-icon" title="Remover linha" onClick={() => removeItem(idx)}>
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="purchase-ai-draft card purchase-ai-draft-inner">
                <h4 className="purchase-ai-subheading">Adicionar outro item</h4>
                <div className="purchase-ai-item-grid">
                  <div className="purchase-ai-item-product">
                    <SingleSelectInput
                      label="Categoria"
                      placeholder="Digite para buscar ou criar…"
                      options={categoryOptions}
                      value={draftItem.category}
                      onChange={(next) => setDraftItem({ ...draftItem, category: next })}
                      createEntityLabel="categoria"
                    />
                    <SingleSelectSearch
                      label="Produto"
                      placeholder="Buscar ou adicionar…"
                      options={products.map((p) => ({ value: p.id, label: p.name }))}
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
                    <div className="purchase-ai-product-line-type">
                      <span className="purchase-ai-mini-label">Insumo ou venda (esta linha)</span>
                      <div className="purchase-line-type-options" role="radiogroup" aria-label="Insumo ou venda (novo item)">
                        <label className="purchase-line-type-option">
                          <input
                            type="radio"
                            name="draft-ai-line-type"
                            checked={draftItem.lineType === "insumo"}
                            onChange={() => setDraftItem({ ...draftItem, lineType: "insumo" })}
                          />
                          <span>Insumo</span>
                        </label>
                        <label className="purchase-line-type-option">
                          <input
                            type="radio"
                            name="draft-ai-line-type"
                            checked={draftItem.lineType === "venda"}
                            onChange={() => setDraftItem({ ...draftItem, lineType: "venda" })}
                          />
                          <span>Venda</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="field purchase-ai-field">
                    <label>Qtd</label>
                    <input
                      type="number"
                      className="purchase-ai-input"
                      min="0"
                      step="any"
                      value={draftItem.quantity}
                      onChange={(e) => setDraftItem({ ...draftItem, quantity: e.target.value })}
                    />
                  </div>
                  <div className="field purchase-ai-field">
                    <label>Unid.</label>
                    <UnitSelect
                      className="purchase-ai-input"
                      value={draftItem.unitUsed}
                      units={unitOptions}
                      products={products}
                      onChange={(e) => setDraftItem({ ...draftItem, unitUsed: e.target.value })}
                    />
                  </div>
                  <div className="field purchase-ai-field">
                    <label>Valor un.</label>
                    <input
                      type="number"
                      className="purchase-ai-input"
                      min="0"
                      step="0.01"
                      value={draftItem.unitPrice}
                      onChange={(e) => setDraftItem({ ...draftItem, unitPrice: e.target.value })}
                    />
                  </div>
                  <div className="purchase-ai-item-actions purchase-ai-add-actions">
                    <button type="button" className="btn btn-secondary" onClick={addItem}>
                      <FaPlus style={{ marginRight: "0.35rem" }} />
                      Incluir na lista
                    </button>
                  </div>
                </div>
              </div>

              <p className="purchase-ai-total">
                Total: <strong>{formatCurrency(total)}</strong>
              </p>
            </section>

            {docTotalRows.length ? (
              <section className="card purchase-ai-section purchase-ai-doc-totals" aria-label="Totais da nota fiscal">
                <h4 className="purchase-ai-subheading">Totais da nota</h4>
                <p className="field-helper purchase-ai-doc-totals-hint">
                  O valor da compra na nota é maior (ou menor) que a soma dos produtos. O lançamento usa só as linhas acima; a diferença
                  pode ser frete, ICMS ST ou outras despesas.
                </p>
                <dl className="purchase-ai-doc-totals-dl">
                  {docTotalRows.map((r) => (
                    <div key={r.label} className="purchase-ai-doc-totals-row">
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {aiMissing.length ? (
              <section className="card purchase-ai-section purchase-ai-warnings">
                <h4 className="purchase-ai-subheading">Ajustes sugeridos</h4>
                <ul className="purchase-ai-warning-list">
                  {aiMissing.map((msg, i) => (
                    <li key={`${i}-${msg}`}>{msg}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer className="purchase-ai-footer card">
              <button
                type="button"
                className="btn btn-primary purchase-ai-register-btn"
                disabled={!canConfirmPurchase}
                onClick={() => void confirmPurchase()}
              >
                {confirming ? "A registar…" : "Registrar compra"}
              </button>
              <p className="purchase-ai-footer-hint">
                {aiLoading
                  ? "Aguarde a análise da IA…"
                  : confirming
                    ? "A guardar a compra e os anexos…"
                    : !canConfirmPurchase
                      ? "Para registar: nota no cartão de análise, fornecedor, itens com produto, categoria, quantidade e preço em todas as linhas."
                      : `Pronto para registar. Total a enviar: ${receipts.length + receiptExtras.length} ficheiro(s).`}
              </p>
            </footer>
          </div>
        </div>
      </div>
      {toast ? <div className="toast toast-success">{toast}</div> : null}
    </AppShell>
  );
}
