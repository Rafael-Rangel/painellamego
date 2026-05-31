import { useEffect, useMemo, useRef, useState } from "react";
import { catalogNotFoundOnBlur, logCatalog } from "../../lib/catalogFeedback";
import RequiredLabel, { FieldValidationMessage } from "./RequiredLabel";

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SingleSelectSearch({
  label,
  placeholder = "Digite para buscar...",
  options = [],
  value = "",
  onChange,
  allowCreate = false,
  onCreateOption,
  createBusy = false,
  createEntityLabel = "fornecedor",
  catalogField = "supplier",
  minCreateLength = 2,
  inputClassName = "",
  onNotify,
  required = false,
  showValidationError = false,
  validationMessage = "",
  onFieldBlur,
  /** Texto livre quando value está vazio (ex.: nome lido na NF pela IA). */
  initialText = "",
  /** Chamado ao sair do campo sem produto selecionado (texto digitado/lido). */
  onFreeTextChange
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  /** Texto fixo no input enquanto cria no catálogo (não limpar durante o loading). */
  const [pendingCreateLabel, setPendingCreateLabel] = useState(null);
  const [inlineError, setInlineError] = useState("");
  const lastValueRef = useRef(value);

  const selected = useMemo(() => (options || []).find((o) => o.value === value) || null, [options, value]);
  const isLocked = createBusy || !!pendingCreateLabel;

  const displayText = isLocked ? pendingCreateLabel || inputText : inputText || selected?.label || "";

  const filtered = useMemo(() => {
    const nq = normalize(inputText || "");
    if (!nq) return (options || []).slice(0, 30);
    return (options || [])
      .filter((o) => normalize(o.label).includes(nq))
      .slice(0, 30);
  }, [options, inputText]);

  const trimmedQ = (inputText || "").trim();

  const hasExactMatch = useMemo(() => {
    const nq = normalize(trimmedQ);
    if (!nq) return false;
    return (options || []).some((o) => normalize(o.label) === nq);
  }, [options, trimmedQ]);

  const canOfferCreate =
    allowCreate &&
    typeof onCreateOption === "function" &&
    trimmedQ.length >= minCreateLength &&
    !hasExactMatch &&
    !isLocked;

  useEffect(() => {
    if (isLocked) return;
    if (value === lastValueRef.current && !initialText) return;
    lastValueRef.current = value;
    const opt = (options || []).find((o) => o.value === value);
    if (opt) {
      setInputText(opt.label);
      setPendingCreateLabel(null);
    } else if (!value && !open) {
      setInputText(initialText || "");
    }
  }, [value, options, isLocked, open, initialText]);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) {
        if (!isLocked) setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isLocked]);

  const notify = (message, type = "error") => {
    if (!message) return;
    setInlineError(message);
    onNotify?.(message, type);
  };

  const handleCreate = async () => {
    if (!trimmedQ || isLocked) return;
    const labelToCreate = trimmedQ;
    setPendingCreateLabel(labelToCreate);
    setInputText(labelToCreate);
    setOpen(true);
    setInlineError("");
    logCatalog("create_start", catalogField, { value: labelToCreate });
    try {
      const result = await onCreateOption(labelToCreate);
      if (result === false || result?.ok === false) {
        const msg =
          result?.message ||
          `Não foi possível adicionar ${createEntityLabel} ${quote(labelToCreate)}. Verifique os dados e tente de novo.`;
        notify(msg, "error");
        logCatalog("create_failed", catalogField, { value: labelToCreate, result });
        return;
      }
      logCatalog("create_ok", catalogField, { value: labelToCreate });
      setInlineError("");
      setOpen(false);
    } catch (err) {
      const msg =
        err?.message ||
        `Não foi possível adicionar ${createEntityLabel} ${quote(labelToCreate)}. Tente de novo ou escolha da lista.`;
      notify(msg, "error");
      logCatalog("create_error", catalogField, { value: labelToCreate, error: msg });
    } finally {
      setPendingCreateLabel(null);
    }
  };

  function quote(s) {
    const t = String(s || "").trim();
    return t ? `“${t}”` : "";
  }

  const hasProduct = value || String(initialText || inputText || "").trim().length >= minCreateLength;
  const showRequiredError = showValidationError && validationMessage && !hasProduct;
  const inputInvalid = inlineError || showRequiredError;

  return (
    <div
      className={`field field-styled ms-root${isLocked ? " ms-root--busy" : ""}${showRequiredError ? " field--invalid" : ""}`}
      ref={rootRef}
      aria-busy={isLocked}
    >
      {label ? <RequiredLabel required={required}>{label}</RequiredLabel> : null}
      <div className="ms-input-wrap">
        <input
          ref={inputRef}
          className={[inputClassName, isLocked ? "ms-input-locked" : ""].filter(Boolean).join(" ") || undefined}
          value={displayText}
          placeholder={placeholder}
          readOnly={isLocked}
          aria-readonly={isLocked}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            if (isLocked) return;
            const next = e.target.value;
            setInputText(next);
            if (inlineError) setInlineError("");
            if (!value) return;
            const stillMatches =
              selected && normalize(next) === normalize(selected.label);
            if (!stillMatches) onChange("");
          }}
          onBlur={() => {
            if (isLocked) return;
            setOpen(false);
            onFieldBlur?.();
            if (value) return;
            if (!trimmedQ) {
              setInlineError("");
              return;
            }
            const exact = (options || []).find((o) => normalize(o.label) === normalize(trimmedQ));
            if (exact) {
              onChange(exact.value);
              setInputText(exact.label);
              setInlineError("");
              return;
            }
            if (trimmedQ.length >= minCreateLength && typeof onFreeTextChange === "function") {
              onFreeTextChange(trimmedQ);
              setInlineError("");
              return;
            }
            if (trimmedQ.length >= minCreateLength) {
              const msg = catalogNotFoundOnBlur(catalogField, trimmedQ);
              notify(msg, "warning");
            } else {
              const msg = `Digite pelo menos ${minCreateLength} caracteres ou escolha um item da lista.`;
              notify(msg, "warning");
            }
          }}
          aria-invalid={inputInvalid ? "true" : undefined}
          aria-describedby={inputInvalid ? `${catalogField}-hint` : undefined}
        />
        {isLocked ? <span className="ms-input-spinner" aria-hidden /> : null}
      </div>
      {open ? (
        <div className="ms-popover" role="listbox">
          <div className="ms-options">
            {isLocked ? (
              <div className="ss-create-status" role="status">
                <span className="ss-create-status__spinner" aria-hidden />
                <span>
                  Adicionando {createEntityLabel}{" "}
                  <strong>“{pendingCreateLabel || trimmedQ}”</strong>…
                </span>
              </div>
            ) : (
              <>
                {filtered.map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    className="ss-option-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(o.value);
                      setInputText(o.label);
                      setOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                ))}
                {canOfferCreate ? (
                  <button
                    type="button"
                    className="ss-option-btn ss-option-create"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleCreate()}
                  >
                    {`+ Adicionar ${createEntityLabel} “${trimmedQ}”`}
                  </button>
                ) : null}
                {!filtered.length && !canOfferCreate && trimmedQ.length > 0 && trimmedQ.length < minCreateLength ? (
                  <p className="ms-hint-empty">Digite pelo menos {minCreateLength} caracteres para adicionar.</p>
                ) : null}
                {!filtered.length && !canOfferCreate && (!trimmedQ || trimmedQ.length >= minCreateLength) ? (
                  <p className="ms-hint-empty">
                    {trimmedQ
                      ? `Nenhum ${createEntityLabel} encontrado com esse nome. Use «+ Adicionar» ou corrija a digitação.`
                      : "Digite para buscar."}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
      {showRequiredError ? (
        <FieldValidationMessage id={`${catalogField}-hint`}>{validationMessage}</FieldValidationMessage>
      ) : null}
      {inlineError ? (
        <p className="ms-field-error" id={showRequiredError ? undefined : `${catalogField}-hint`} role="alert">
          {inlineError}
        </p>
      ) : null}
    </div>
  );
}
