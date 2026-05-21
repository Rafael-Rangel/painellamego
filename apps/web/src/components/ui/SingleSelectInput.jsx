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
  /** Rótulo no botão de criar valor novo (ex.: categoria, unidade). */
  createEntityLabel = "valor",
  minCreateLength = 2
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || "");

  useEffect(() => {
    setQ(value || "");
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return (options || []).slice(0, 30);
    return (options || [])
      .filter((o) => normalize(o).includes(nq))
      .slice(0, 30);
  }, [options, q]);

  const trimmedQ = (q || "").trim();

  const hasExactMatch = useMemo(() => {
    const nq = normalize(trimmedQ);
    if (!nq) return false;
    return (options || []).some((o) => normalize(o) === nq);
  }, [options, trimmedQ]);

  const canOfferCreate = trimmedQ.length >= minCreateLength && !hasExactMatch;

  const applyCustomValue = () => {
    if (!trimmedQ) return;
    onChange(trimmedQ);
    setQ(trimmedQ);
    setOpen(false);
  };

  const showEmptyHint = !filtered.length && !canOfferCreate;

  return (
    <div className="field ms-root" ref={rootRef}>
      {label ? <label>{label}</label> : null}
      <input
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQ(next);
          onChange(next);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="ms-popover" role="listbox">
          <div className="ms-options">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className="ss-option-btn"
                onClick={() => {
                  onChange(opt);
                  setQ(opt);
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
            {showEmptyHint ? (
              <p className="empty" style={{ margin: 0, padding: "0.6rem 0.7rem" }}>
                {trimmedQ.length > 0 && trimmedQ.length < minCreateLength
                  ? `Digite pelo menos ${minCreateLength} caracteres.`
                  : trimmedQ
                    ? "Sem opções salvas. Use o botão acima ou continue a digitar."
                    : "Digite para buscar ou criar."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
