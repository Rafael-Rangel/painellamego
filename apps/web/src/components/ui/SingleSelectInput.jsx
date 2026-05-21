import { useEffect, useMemo, useRef, useState } from "react";

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SingleSelectInput({
  label,
  placeholder = "Digite para buscar...",
  options = [],
  value = "",
  onChange,
  createEntityLabel = "valor",
  minCreateLength = 2
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value || "");
  const [pendingApplyLabel, setPendingApplyLabel] = useState(null);
  const lastValueRef = useRef(value);

  const isLocked = !!pendingApplyLabel;
  const displayText = isLocked ? pendingApplyLabel : inputText;

  useEffect(() => {
    if (isLocked) return;
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    setInputText(value || "");
    setPendingApplyLabel(null);
  }, [value, isLocked]);

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

  const filtered = useMemo(() => {
    const nq = normalize(inputText || "");
    if (!nq) return (options || []).slice(0, 30);
    return (options || [])
      .filter((o) => normalize(o).includes(nq))
      .slice(0, 30);
  }, [options, inputText]);

  const trimmedQ = (inputText || "").trim();

  const hasExactMatch = useMemo(() => {
    const nq = normalize(trimmedQ);
    if (!nq) return false;
    return (options || []).some((o) => normalize(o) === nq);
  }, [options, trimmedQ]);

  const canOfferCreate = trimmedQ.length >= minCreateLength && !hasExactMatch && !isLocked;

  const applyCustomValue = () => {
    if (!trimmedQ || isLocked) return;
    const labelToApply = trimmedQ;
    setPendingApplyLabel(labelToApply);
    setInputText(labelToApply);
    setOpen(true);
    onChange(labelToApply);
    requestAnimationFrame(() => {
      setPendingApplyLabel(null);
      setOpen(false);
    });
  };

  return (
    <div className={`field ms-root${isLocked ? " ms-root--busy" : ""}`} ref={rootRef} aria-busy={isLocked}>
      {label ? <label>{label}</label> : null}
      <div className="ms-input-wrap">
        <input
          className={isLocked ? "ms-input-locked" : undefined}
          value={displayText}
          placeholder={placeholder}
          readOnly={isLocked}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            if (isLocked) return;
            const next = e.target.value;
            setInputText(next);
            onChange(next);
            setOpen(true);
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
                  A aplicar {createEntityLabel} <strong>“{pendingApplyLabel}”</strong>…
                </span>
              </div>
            ) : (
              <>
                {filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="ss-option-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(opt);
                      setInputText(opt);
                      setOpen(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
                {canOfferCreate ? (
                  <button
                    type="button"
                    className="ss-option-btn ss-option-create"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={applyCustomValue}
                  >
                    {`+ Usar ${createEntityLabel} “${trimmedQ}”`}
                  </button>
                ) : null}
                {!filtered.length && !canOfferCreate ? (
                  <p className="ms-hint-empty">
                    {trimmedQ.length > 0 && trimmedQ.length < minCreateLength
                      ? `Digite pelo menos ${minCreateLength} caracteres.`
                      : trimmedQ
                        ? "Sem opções salvas. Use o botão acima ou continue a digitar."
                        : "Digite para buscar ou criar."}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
