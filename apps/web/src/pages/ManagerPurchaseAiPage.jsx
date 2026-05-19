import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaRobot, FaStore, FaTimes, FaTrash } from "react-icons/fa";
import AppShell from "../components/AppShell";
import ReceiptAiDropzoneCard from "../components/purchase/ReceiptAiDropzoneCard";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { useAuth } from "../auth/AuthProvider";
import SingleSelectSearch from "../components/ui/SingleSelectSearch";
import UnitSelect from "../components/ui/UnitSelect";
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
    draftItem,
    setDraftItem,
    toast,
    aiLoading,
    aiMissing,
    total,
    addItem,
    updateItem,
    removeItem,
    confirmPurchase,
    parseReceiptsByAI,
    aiHighlightKeys,
    clearAiHighlight,
    clearItemRowAiHighlight,
    createSupplier,
    supplierCreating,
    createProduct,
    productCreating
  } = usePurchaseForm(token, { recordAiHighlights: true, onAfterConfirm });

  const handleDropzoneFiles = useCallback(
    (files) => {
      lastAnalyzedSigRef.current = "";
      setReceipts(files);
      setReceiptExtras([]);
    },
    [setReceipts, setReceiptExtras]
  );

  const handleOptionalReceiptChange = useCallback(
    (e) => {
      const list = Array.from(e.target.files || []).filter(Boolean);
      e.target.value = "";
      if (!list.length) return;
      appendReceiptExtras(list);
    },
    [appendReceiptExtras]
  );

  useEffect(() => {
    if (!receipts.length || aiLoading) return;
    const sig = receipts.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|");
    if (sig === lastAnalyzedSigRef.current) return;
    lastAnalyzedSigRef.current = sig;
    void (async () => {
      const ok = await parseReceiptsByAI({ onSuccess: () => {} });
      if (!ok) lastAnalyzedSigRef.current = "";
    })();
  }, [receipts, aiLoading, parseReceiptsByAI]);

  const links = useMemo(() => buildManagerSidebarLinks(navigate), [navigate]);

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

  const fileNames = useMemo(() => receipts.map((f) => f.name), [receipts]);

  const canRegister =
    !aiLoading &&
    Boolean(supplierId) &&
    receipts.length > 0 &&
    items.length > 0 &&
    items.every((it) => {
      const hasProduct = Boolean(it.productId) || String(it.aiRawProductName || "").trim().length >= 2;
      return hasProduct && it.quantity && Number(it.quantity) > 0 && it.unitPrice && Number(it.unitPrice) > 0;
    });

  const aiClass = (key) => (aiHighlightKeys?.has(key) ? "field-ai-suggested" : "");

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
            fileNames={fileNames}
            onFilesChange={handleDropzoneFiles}
          />

          <div className="card purchase-ai-optional-receipt">
            <label className="purchase-ai-optional-label" htmlFor="purchase-ai-extra-receipt">
              Anexo adicional (opcional)
            </label>
            <p className="field-helper purchase-ai-optional-hint">
              Outros PDFs ou imagens que devam ficar no registro (ex.: verso, complemento). Não voltam a disparar a leitura por IA — para
              analisar vários ficheiros de uma vez, use &quot;Selecionar arquivo(s)&quot; no cartão acima na mesma seleção.
            </p>
            <input
              id="purchase-ai-extra-receipt"
              type="file"
              className="purchase-ai-input"
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              disabled={!token || aiLoading}
              onChange={handleOptionalReceiptChange}
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
                <FaRobot className="purchase-ai-section-icon" aria-hidden />
                Itens da nota
              </h3>
              <p className="purchase-ai-section-desc">Cada linha corresponde a um produto. Edite ou complete o que a IA não tiver identificado.</p>

              {items.length === 0 ? (
                <p className="purchase-ai-empty-items">Nenhum item ainda. Após a análise da nota, as linhas aparecem aqui; pode também adicionar linhas manualmente.</p>
              ) : (
                <ul className="purchase-ai-item-list">
                  {items.map((row, idx) => (
                    <li key={`line-${idx}`} className={`purchase-ai-item-row card ${aiHighlightKeys?.has(`item.${idx}`) ? "purchase-ai-item-suggested" : ""}`}>
                      <div className="purchase-ai-item-grid">
                        <div className="purchase-ai-item-product">
                          <SingleSelectSearch
                            label="Produto"
                            placeholder="Buscar ou adicionar produto…"
                            options={products.map((p) => ({ value: p.id, label: p.name }))}
                            value={row.productId}
                            onChange={(id) => {
                              clearItemRowAiHighlight(idx);
                              const product = products.find((p) => p.id === id);
                              const suggestion = product?.type === "venda" ? "venda" : "insumo";
                              updateItem(idx, { productId: id, lineType: suggestion, aiRawProductName: undefined });
                            }}
                            allowCreate
                            createEntityLabel="produto"
                            createBusy={productCreating}
                            onCreateOption={async (q) => {
                              const data = await createProduct(q, row.lineType);
                              if (!data) return;
                              const suggestion = data.type === "venda" ? "venda" : "insumo";
                              updateItem(idx, {
                                productId: data.id,
                                lineType: suggestion,
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
                        const data = await createProduct(q, draftItem.lineType);
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
              <button type="button" className="btn btn-primary purchase-ai-register-btn" disabled={!canRegister} onClick={() => void confirmPurchase()}>
                Registrar compra
              </button>
              <p className="purchase-ai-footer-hint">
                {aiLoading
                  ? "Aguarde a análise da IA…"
                  : `É obrigatório pelo menos um ficheiro no cartão de análise acima. Anexos adicionais são opcionais. Total a enviar: ${receipts.length + receiptExtras.length} ficheiro(s). Confira fornecedor e itens antes de confirmar.`}
              </p>
            </footer>
          </div>
        </div>
      </div>
      {toast ? <div className="toast toast-success">{toast}</div> : null}
    </AppShell>
  );
}
