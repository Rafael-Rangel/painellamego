import { useEffect, useMemo, useRef, useState } from "react";

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
  minCreateLength = 2,
  inputClassName = ""
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  /** Texto fixo no input enquanto cria no catálogo (não limpar durante o loading). */
  const [pendingCreateLabel, setPendingCreateLabel] = useState(null);
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
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    const opt = (options || []).find((o) => o.value === value);
    if (opt) {
      setInputText(opt.label);
      setPendingCreateLabel(null);
    } else if (!value && !open) {
      setInputText("");
    }
  }, [value, options, isLocked, open]);

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

  const handleCreate = async () => {
    if (!trimmedQ || isLocked) return;
    const labelToCreate = trimmedQ;
    setPendingCreateLabel(labelToCreate);
    setInputText(labelToCreate);
    setOpen(true);
    try {
      await onCreateOption(labelToCreate);
      setOpen(false);
    } catch {
      /* toast no pai */
    } finally {
      setPendingCreateLabel(null);
    }
  };

  return (
    <div
      className={`field field-styled ms-root${isLocked ? " ms-root--busy" : ""}`}
      ref={rootRef}
      aria-busy={isLocked}
    >
      {label ? <label>{label}</label> : null}
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
            if (value) onChange("");
          }}
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
                  <p className="ms-hint-empty">{trimmedQ ? "Nenhum resultado." : "Digite para buscar."}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
