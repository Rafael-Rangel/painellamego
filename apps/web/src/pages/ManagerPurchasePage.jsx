import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaCheck, FaCloudUploadAlt, FaFileInvoice, FaShoppingBasket } from "react-icons/fa";
import AppShell from "../components/AppShell";
import FilePickButton from "../components/ui/FilePickButton";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { useAuth } from "../auth/AuthProvider";
import HintButton from "../components/ui/HintButton";
import { WizardAlert, WizardAlerts, toastKindFromMessage } from "../components/ui/WizardAlert";
import SingleSelectSearch from "../components/ui/SingleSelectSearch";
import PurchaseDraftItemForm from "../components/purchase/PurchaseDraftItemForm";
import PurchaseRegisteredItems from "../components/purchase/PurchaseRegisteredItems";
import { formatStoreReadonly } from "../lib/displayText";
import { formatCurrency } from "../lib/formatters";
import { getDraftItemFieldErrors } from "../lib/draftItemValidation";
import { purchaseTotalsFromItems, validateInstallmentsAgainstPayable } from "../lib/purchaseTotals";
import { usePurchaseForm } from "../hooks/usePurchaseForm";
import { usePurchaseDraft } from "../hooks/usePurchaseDraft";
import { useWizardStepValidation } from "../hooks/useWizardStepValidation";
import RequiredLabel, { FieldValidationMessage } from "../components/ui/RequiredLabel";
import PurchaseInstallmentsEditor from "../components/purchase/PurchaseInstallmentsEditor";

const STEPS = [
  { n: 1, title: "Dados", hint: "Data, fornecedor e NF" },
  { n: 2, title: "Itens", hint: "Compra e bonificação" },
  { n: 3, title: "Vencimentos", hint: "Parcelas do boleto" },
  { n: 4, title: "Fotos da nota", hint: "Opcional, pode pular" },
  { n: 5, title: "Conferir", hint: "Rascunho ou publicar" }
];

export default function ManagerPurchasePage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [draftReady, setDraftReady] = useState(false);
  const [itemAddAttempted, setItemAddAttempted] = useState(false);
  const { markStepAttempted, touchField, shouldShow, wasStepAttempted } = useWizardStepValidation();

  const onAfterConfirm = useCallback(() => {
    setStep(1);
    setSearchParams({});
  }, [setSearchParams]);

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
    appendReceipts,
    items,
    draftItem,
    setDraftItem,
    toast,
    total,
    addItem,
    updateItem,
    removeItemAt,
    editingItemIndex,
    loadItemForEdit,
    cancelItemEdit,
    savePurchaseDraft,
    confirmPurchase,
    confirming,
    createSupplier,
    supplierCreating,
    createProduct,
    productCreating,
    setToast,
    installments,
    setInstallments,
    setItems
  } = usePurchaseForm(token, { recordAiHighlights: false, onAfterConfirm });

  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  /** Evita recarregar do servidor um rascunho que acabámos de criar na mesma sessão. */
  const sessionDraftRef = useRef(null);

  const draftPayload = useMemo(
    () => ({
      supplierId: supplierId || null,
      purchaseDate: date,
      invoiceNumber,
      wizardStep: step,
      items,
      installments
    }),
    [supplierId, date, invoiceNumber, step, items, installments]
  );

  const {
    draftId,
    serverReceipts,
    saveState,
    lastSavedAt,
    loadDraft,
    createDraft,
    saveDraft,
    uploadReceipts,
    removeServerReceipt,
    resetDraftSession
  } = usePurchaseDraft(token, { payload: draftPayload, enabled: draftReady });

  const draftQuery = searchParams.get("draft");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const stepFromUrl = searchParams.get("step");
    (async () => {
      try {
        if (draftQuery) {
          if (sessionDraftRef.current === draftQuery) {
            setDraftReady(true);
            return;
          }
          const d = await loadDraft(draftQuery);
          if (cancelled) return;
          sessionDraftRef.current = draftQuery;
          if (d.supplierId) setSupplierId(d.supplierId);
          if (d.purchaseDate) setDate(d.purchaseDate);
          if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber);
          setItems(d.items || []);
          setInstallments(d.installments || []);
          const parsed = stepFromUrl ? Math.min(5, Math.max(1, Number(stepFromUrl) || 1)) : null;
          setStep(parsed ?? d.wizardStep ?? 1);
          if (stepFromUrl) {
            setSearchParams({ draft: draftQuery }, { replace: true });
          }
        } else {
          sessionDraftRef.current = null;
          setStep(1);
        }
        setDraftReady(true);
      } catch {
        setToast("Não foi possível iniciar o rascunho. Tente recarregar.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, draftQuery]);

  const hasReceipts = receipts.length > 0 || serverReceipts.length > 0;

  const installmentCheck = useMemo(() => {
    const { totalPayable } = purchaseTotalsFromItems(items);
    return validateInstallmentsAgainstPayable(installments, totalPayable);
  }, [items, installments]);

  const invoiceTrimmed = useMemo(() => String(invoiceNumber || "").trim(), [invoiceNumber]);
  const hasInvoice = invoiceTrimmed.length > 0;

  const ensureDraftId = useCallback(async () => {
    if (draftId) return draftId;
    const id = await createDraft();
    await saveDraft({ ...draftPayload, wizardStep: step }, id);
    sessionDraftRef.current = id;
    setSearchParams({ draft: id }, { replace: true });
    return id;
  }, [draftId, createDraft, saveDraft, draftPayload, step, setSearchParams]);

  const goNextStep = useCallback(async () => {
    if (step === 1) {
      markStepAttempted(1);
      if (!supplierId) {
        touchField("supplier");
        setToast("Selecione ou crie o fornecedor para continuar.");
        setTimeout(() => setToast(""), 4200);
        return;
      }
      if (!hasInvoice) {
        touchField("invoice");
        setToast("Informe o número da nota fiscal.");
        setTimeout(() => setToast(""), 4200);
        return;
      }
      if (!draftId) {
        try {
          await ensureDraftId();
        } catch {
          setToast("Não foi possível sincronizar o rascunho. Tente novamente.");
          setTimeout(() => setToast(""), 4200);
          return;
        }
      }
    }
    if (step === 2 && items.length === 0) {
      markStepAttempted(2);
      setToast("Adicione pelo menos um item antes de continuar.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (step === 2 && total <= 0) {
      markStepAttempted(2);
      setToast("Informe quantidade e valor unitário — o total da nota não pode ficar zerado.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (step === 3 && installments.length > 0 && !installmentCheck.ok && total > 0) {
      markStepAttempted(3);
      setToast("Ajuste as parcelas para igualar o total da nota.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (step === 4 && !hasReceipts) {
      markStepAttempted(4);
    }
    setStep((s) => s + 1);
  }, [
    step,
    supplierId,
    hasInvoice,
    draftId,
    ensureDraftId,
    items.length,
    installments.length,
    installmentCheck.ok,
    total,
    hasReceipts,
    setToast,
    markStepAttempted,
    touchField
  ]);

  const links = useMemo(() => buildManagerSidebarLinks(navigate), [navigate]);

  const canGoNext =
    step === 1
      ? Boolean(supplierId) && hasInvoice
      : step === 2
        ? items.length > 0 && total > 0
        : step < 5
          ? true
          : false;

  const nextStepBlockReason =
    step === 1 && !supplierId
      ? "Selecione ou crie o fornecedor para continuar."
      : step === 1 && !hasInvoice
        ? "Informe o número da nota fiscal."
        : step === 2 && items.length === 0
        ? "Nenhum item cadastrado ainda. Adicione pelo menos 1 item para liberar o botão «Próximo»."
        : step === 2 && total <= 0
          ? "Informe quantidade e valor unitário — o total da nota não pode ficar zerado."
        : null;

  const saveDraftBlockReason =
    !supplierId
      ? "Selecione o fornecedor antes de guardar."
      : !hasInvoice
        ? "Informe o número da nota fiscal antes de guardar."
        : items.length === 0
        ? "Nenhum item na nota. Adicione pelo menos 1 item para guardar ou publicar."
        : null;

  const handleDeleteItem = useCallback(
    (idx, productName) => {
      const label = String(productName || "este item").trim();
      if (!window.confirm(`Remover «${label}» da nota?\n\nEsta ação não pode ser desfeita.`)) return;
      removeItemAt(idx);
      setToast("Item removido.");
      setTimeout(() => setToast(""), 2800);
    },
    [removeItemAt, setToast]
  );

  const handleReceiptPick = useCallback(
    async (files) => {
      if (!files?.length) return;
      setUploadingReceipts(true);
      try {
        const id = await ensureDraftId();
        await uploadReceipts(files, id);
        setToast("Fotos enviadas. Toque em «Próximo» para conferir (passo 5) antes de publicar.");
        setTimeout(() => setToast(""), 4500);
      } catch {
        appendReceipts(files);
        setToast("Não foi possível enviar agora; os ficheiros ficaram no aparelho. Tente novamente.");
        setTimeout(() => setToast(""), 5000);
      } finally {
        setUploadingReceipts(false);
      }
    },
    [ensureDraftId, uploadReceipts, appendReceipts, setToast]
  );

  const showSupplierError = shouldShow(1, "supplier") && !supplierId;
  const showInvoiceError = shouldShow(1, "invoice") && !hasInvoice;
  const showItemsStepError = wasStepAttempted(2) && items.length === 0;
  const showInstallmentsError =
    shouldShow(3) && installments.length > 0 && !installmentCheck.ok && total > 0;
  const showReceiptsHint = shouldShow(4) && !hasReceipts;
  const showReviewValidation = shouldShow(5);

  const draftItemErrors = useMemo(() => getDraftItemFieldErrors(draftItem, products), [draftItem, products]);
  const showItemFieldValidation = itemAddAttempted || shouldShow(2, "itemFields");

  const stepAlerts = useMemo(() => [], []);

  useEffect(() => {
    if (items.length > 0) setItemAddAttempted(false);
  }, [items.length]);

  const handleAddItem = useCallback(() => {
    setItemAddAttempted(true);
    touchField("itemFields");
    addItem();
  }, [addItem, touchField]);

  const handleItemFieldBlur = useCallback(
    (field) => {
      touchField(field);
      touchField("itemFields");
    },
    [touchField]
  );

  const handlePublish = useCallback(() => {
    markStepAttempted(5);
    if (!supplierId || !hasInvoice || items.length === 0) {
      setToast("Complete fornecedor, número da NF e itens antes de publicar.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (total <= 0) {
      setToast("Não é possível publicar nota com total zerado. Revise quantidade e preço dos itens.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (installments.length > 0 && !installmentCheck.ok && total > 0) {
      setToast("Corrija as parcelas no passo 3 antes de publicar.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (!hasReceipts) {
      setToast("Para publicar, anexe pelo menos uma foto ou PDF no passo 4 (ou use «Salvar rascunho»).");
      setTimeout(() => setToast(""), 5500);
      return;
    }
    void confirmPurchase({
      draftId,
      serverReceiptCount: serverReceipts.length,
      uploadDraftReceipts: uploadReceipts,
      createDraft: ensureDraftId,
      persistDraft: saveDraft
    }).then(() => {
      sessionDraftRef.current = null;
      resetDraftSession();
      setSearchParams({}, { replace: true });
    });
  }, [
    hasReceipts,
    confirmPurchase,
    draftId,
    serverReceipts.length,
    uploadReceipts,
    ensureDraftId,
    saveDraft,
    setSearchParams,
    setToast,
    resetDraftSession,
    markStepAttempted,
    installmentCheck.ok,
    hasInvoice
  ]);

  const handleSaveDraft = useCallback(() => {
    markStepAttempted(5);
    if (!supplierId) {
      touchField("supplier");
      setToast("Selecione o fornecedor antes de guardar.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (!hasInvoice) {
      touchField("invoice");
      setToast("Informe o número da nota fiscal antes de guardar.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (items.length === 0) {
      setToast("Adicione pelo menos um item antes de guardar.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    if (total <= 0) {
      setToast("O total da nota está zerado. Revise quantidade e preço dos itens.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    void savePurchaseDraft({
      draftId,
      createDraft: ensureDraftId,
      persistDraft: saveDraft,
      uploadDraftReceipts: uploadReceipts
    }).then((id) => {
      if (id) {
        sessionDraftRef.current = null;
        resetDraftSession();
        setSearchParams({}, { replace: true });
      }
    });
  }, [
    savePurchaseDraft,
    draftId,
    ensureDraftId,
    saveDraft,
    uploadReceipts,
    setSearchParams,
    resetDraftSession,
    markStepAttempted,
    supplierId,
    items.length,
    touchField,
    setToast,
    hasInvoice
  ]);

  const storeBadge =
    overview?.storeCode != null && String(overview.storeCode).length
      ? `Loja ${overview.storeCode}${overview.storeName ? ` · ${overview.storeName}` : ""}`
      : null;

  const lojaReadonly = formatStoreReadonly(overview, user);

  const notifyCatalog = useCallback(
    (msg, severity) => {
      if (!msg) return;
      setToast(msg);
      const delay = severity === "warning" ? 5500 : 6000;
      setTimeout(() => setToast(""), delay);
    },
    [setToast]
  );

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
          <p className="wizard-lead">
            Preencha as etapas normalmente. No passo 4 as fotos são opcionais. No fim, guarde como rascunho ou publique
            (publicar exige anexo).
          </p>
          {saveState === "saved" && lastSavedAt ? (
            <p className="purchase-draft-status">Sincronizado {lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (rascunho automático — continue até o passo 5)</p>
          ) : null}
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
          <WizardAlerts alerts={stepAlerts} />
          {toast ? (
            <WizardAlert type={toastKindFromMessage(toast)} onDismiss={() => setToast("")}>
              {toast}
            </WizardAlert>
          ) : null}

          {step === 1 ? (
            <div className="wizard-step-content">
              <h3 className="wizard-panel-title">Quem fornece e quando</h3>
              <p className="wizard-panel-desc">
                Cadastre a compra passo a passo, preenchendo os dados necessários e anexando a nota fiscal antes da
                confirmação.
              </p>
              <div className="wizard-fields">
                <div className="field field-wizard">
                  <label>
                    Data da compra <span className="field-required" aria-hidden="true">*</span>
                  </label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div
                  className={`field field-wizard field-wizard-supplier${showSupplierError ? " field--invalid" : ""}`}
                >
                  <SingleSelectSearch
                    label="Fornecedor"
                    required
                    placeholder="Digite para buscar ou adicionar…"
                    options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                    value={supplierId}
                    onChange={setSupplierId}
                    allowCreate
                    createEntityLabel="fornecedor"
                    catalogField="supplier"
                    createBusy={supplierCreating}
                    onNotify={notifyCatalog}
                    onCreateOption={createSupplier}
                    showValidationError={showSupplierError}
                    validationMessage="Selecione um fornecedor da lista ou crie um novo."
                    onFieldBlur={() => touchField("supplier")}
                  />
                </div>
                <div className={`field field-wizard${showInvoiceError ? " field--invalid" : ""}`}>
                  <RequiredLabel htmlFor="purchase-invoice-number" required>
                    Número da nota fiscal
                  </RequiredLabel>
                  <input
                    id="purchase-invoice-number"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    onBlur={() => touchField("invoice")}
                    placeholder="Ex.: 12345 ou chave resumida"
                    autoComplete="off"
                    aria-invalid={showInvoiceError ? "true" : undefined}
                    required
                  />
                  {showInvoiceError ? (
                    <FieldValidationMessage>Informe o número da nota fiscal.</FieldValidationMessage>
                  ) : (
                    <span className="field-helper">A IA na página Compra com IA pode sugerir este número; aqui pode editar à mão.</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="wizard-step-content wizard-step-content--items">
              <div className="wizard-step-content__intro">
                <div className="wizard-section-icon">
                  <FaShoppingBasket />
                </div>
                <h3 className="wizard-panel-title">Itens da nota fiscal</h3>
                <p className="wizard-panel-desc">
                  Busque o produto, escolha a categoria, informe quantidade e valor.
                </p>
              </div>

              <div className="purchase-items-layout">
                <section className="purchase-items-layout__form" aria-label="Novo item">
                  <PurchaseDraftItemForm
                    draftItem={draftItem}
                    setDraftItem={setDraftItem}
                    categoryOptions={categoryOptions}
                    products={products}
                    unitOptions={unitOptions}
                    pickDraftProduct={pickDraftProduct}
                    createProduct={createProduct}
                    productCreating={productCreating}
                    onAdd={handleAddItem}
                    onNotify={notifyCatalog}
                    editing={editingItemIndex !== null}
                    submitLabel={editingItemIndex !== null ? "Guardar alteração" : "Adicionar item"}
                    onCancel={editingItemIndex !== null ? cancelItemEdit : undefined}
                    showFieldValidation={showItemFieldValidation}
                    fieldErrors={draftItemErrors}
                    listError={showItemsStepError ? "Adicione pelo menos um item na nota antes de avançar." : ""}
                    onFieldBlur={handleItemFieldBlur}
                  />
                </section>

                <section className="purchase-items-layout__list" aria-label="Itens registrados">
                  <PurchaseRegisteredItems
                    items={items}
                    products={products}
                    categoryOptions={categoryOptions}
                    editingIndex={editingItemIndex}
                    updateItem={updateItem}
                    onEdit={loadItemForEdit}
                    onDelete={handleDeleteItem}
                    onNotify={notifyCatalog}
                    emptyMessage="Nenhum item cadastrado ainda."
                  />
                  <p className="wizard-total">
                    Total desta nota: <strong>{formatCurrency(total)}</strong>
                    {items.length === 0 && draftItem?.productId ? (
                      <span className="field-helper" style={{ display: "block", marginTop: "0.35rem" }}>
                        Inclui o item preenchido no formulário. Toque em «Adicionar item» para confirmar na lista.
                      </span>
                    ) : null}
                  </p>
                </section>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="wizard-step-content">
              <div className="wizard-section-icon">
                <FaFileInvoice />
              </div>
              <h3 className="wizard-panel-title">Vencimentos do boleto</h3>
              <p className="wizard-panel-desc">Cadastre uma ou várias datas de parcelas de pagamento.</p>
              <PurchaseInstallmentsEditor
                items={items}
                installments={installments}
                onChange={setInstallments}
                purchaseDate={date}
                showValidation={showInstallmentsError}
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="wizard-step-content">
              <div className="wizard-section-icon">
                <FaCloudUploadAlt />
              </div>
              <h3 className="wizard-panel-title">Fotos / PDF da nota</h3>
              <p className="wizard-panel-desc">
                Envie a foto ou o PDF da nota fiscal. O envio não publica a compra — use «Próximo» para conferir no passo 5
                e só então «Publicar nota» ou «Salvar rascunho».
              </p>
              {serverReceipts.length ? (
                <ul className="purchase-draft-receipts">
                  {serverReceipts.map((r) => (
                    <li key={r.id}>
                      {r.originalName}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeServerReceipt(r.id)}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <FilePickButton
                buttonText={uploadingReceipts ? "A enviar…" : "Enviar fotos da nota"}
                multiple
                disabled={uploadingReceipts}
                onFilesSelected={(files) => void handleReceiptPick(files)}
                helper={
                  uploadingReceipts
                    ? "Aguarde o envio terminar…"
                    : serverReceipts.length || receipts.length
                      ? `${serverReceipts.length} no servidor · ${receipts.length} neste aparelho`
                      : "JPG, PNG ou PDF — opcional nesta etapa"
                }
              />
              {showReceiptsHint ? (
                <FieldValidationMessage className="field-validation-msg--warning">
                  Ainda sem foto ou PDF. Pode continuar e guardar rascunho, ou envie o ficheiro agora para poder publicar
                  na conferência.
                </FieldValidationMessage>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
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
                  <dd>{hasInvoice ? invoiceTrimmed : "n/d"}</dd>
                </div>
                <div>
                  <dt>Anexos</dt>
                  <dd>
                    {serverReceipts.length + receipts.length
                      ? `${serverReceipts.length} na nuvem + ${receipts.length} local`
                      : "Sem arquivo"}
                  </dd>
                </div>
                <div>
                  <dt>Parcelas</dt>
                  <dd>{installments.length ? `${installments.length} vencimento(s)` : "Vencimento único (automático)"}</dd>
                </div>
              </dl>

              <h4 className="wizard-review-sub">Itens</h4>
              <ul className="purchase-review-list">
                {items.map((item, idx) => (
                  <li key={`${item.productId || "pending"}-${idx}`}>
                    <strong>{products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || item.productId || "n/d"}</strong>
                    <span className="wizard-review-meta">
                      {item.category || products.find((p) => p.id === item.productId)?.category || "n/d"} ·{" "}
                      {item.lineType === "venda" ? "Venda" : "Insumo"}
                      {item.isBonificationOnly ? " · Bonificação" : ""} · {item.quantity} {item.unitUsed} ×{" "}
                      {formatCurrency(item.unitPrice)}
                      {Number(item.bonusQuantity) > 0 ? ` · Bonif. ${item.bonusQuantity} un` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="wizard-footer">
          <div className="wizard-footer__nav">
            <HintButton
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              <FaArrowLeft style={{ marginRight: "0.35rem" }} />
              Voltar
            </HintButton>
            {step < 5 ? (
              <HintButton
                disabled={!canGoNext}
                allowClickWhenDisabled
                disabledReason={shouldShow(step) && nextStepBlockReason ? nextStepBlockReason : undefined}
                title={shouldShow(step) && nextStepBlockReason ? nextStepBlockReason : undefined}
                onClick={goNextStep}
                hintClassName="hint-button--align-end"
              >
                Próximo
                <FaArrowRight style={{ marginLeft: "0.35rem" }} />
              </HintButton>
            ) : (
              <div className="wizard-footer__confirm">
                <HintButton
                  variant={hasReceipts ? "ghost" : "primary"}
                  disabled={Boolean(saveDraftBlockReason) || confirming}
                  allowClickWhenDisabled
                  disabledReason={showReviewValidation && saveDraftBlockReason ? saveDraftBlockReason : undefined}
                  title={showReviewValidation && saveDraftBlockReason ? saveDraftBlockReason : undefined}
                  onClick={handleSaveDraft}
                >
                  {confirming ? "A guardar…" : "Salvar rascunho"}
                </HintButton>
                <HintButton
                  variant={hasReceipts ? "primary" : "muted"}
                  disabled={Boolean(saveDraftBlockReason) || confirming || !hasReceipts}
                  allowClickWhenDisabled
                  disabledReason={
                    showReviewValidation && !saveDraftBlockReason && !hasReceipts
                      ? "Para publicar, anexe pelo menos uma foto ou PDF da nota (passo 4 ou pelo lápis no Histórico)."
                      : showReviewValidation && saveDraftBlockReason
                        ? saveDraftBlockReason
                        : undefined
                  }
                  title={
                    showReviewValidation && (saveDraftBlockReason || !hasReceipts)
                      ? saveDraftBlockReason ||
                        "Para publicar, anexe pelo menos uma foto ou PDF da nota (passo 4 ou pelo lápis no Histórico)."
                      : undefined
                  }
                  onClick={handlePublish}
                  hintClassName="hint-button--align-end"
                >
                  {confirming ? "A publicar…" : "Publicar nota"}
                </HintButton>
              </div>
            )}
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
