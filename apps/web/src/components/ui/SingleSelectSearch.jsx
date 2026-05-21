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
  /** Quando o texto não coincide com nenhuma opção, permite criar entrada (ex.: fornecedor, produto). */
  allowCreate = false,
  /** async (trimmedQuery) => void  ·  o pai cria o registo e atualiza options/value. */
  onCreateOption,
  createBusy = false,
  /** Texto do botão “Adicionar …” (ex.: fornecedor, produto). */
  createEntityLabel = "fornecedor",
  minCreateLength = 2,
  inputClassName = ""
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = useMemo(() => (options || []).find((o) => o.value === value) || null, [options, value]);
  const query = q || selected?.label || "";

  const filtered = useMemo(() => {
    const nq = normalize(q || "");
    if (!nq) return (options || []).slice(0, 30);
    return (options || [])
      .filter((o) => normalize(o.label).includes(nq))
      .slice(0, 30);
  }, [options, q]);

  const trimmedQ = (q || "").trim();

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
    !createBusy;

  useEffect(() => {
    const opt = (options || []).find((o) => o.value === value);
    if (opt) setQ(opt.label);
    else if (!value) setQ("");
  }, [value, options]);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showEmptyHint = !filtered.length && !canOfferCreate;

  return (
    <div className="field field-styled ms-root" ref={rootRef}>
      <label>{label}</label>
      <input
        className={inputClassName || undefined}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          if (value) onChange("");
        }}
      />
      {open ? (
        <div className="ms-popover" role="listbox">
          <div className="ms-options">
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className="ss-option-btn"
                onClick={() => {
                  onChange(o.value);
                  setQ(o.label);
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
                disabled={createBusy}
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  if (!trimmedQ || createBusy) return;
                  try {
                    await onCreateOption(trimmedQ);
                    setOpen(false);
                  } catch {
                    /* erro tratado no pai (toast) */
                  }
                }}
              >
                {createBusy ? "A guardar…" : `+ Adicionar ${createEntityLabel} “${trimmedQ}”`}
              </button>
            ) : null}
            {showEmptyHint && trimmedQ.length > 0 && trimmedQ.length < minCreateLength ? (
              <p className="empty" style={{ margin: 0, padding: "0.6rem 0.7rem" }}>
                Digite pelo menos {minCreateLength} caracteres para adicionar.
              </p>
            ) : null}
            {showEmptyHint && (!trimmedQ || trimmedQ.length >= minCreateLength) ? (
              <p className="empty" style={{ margin: 0, padding: "0.6rem 0.7rem" }}>
                {trimmedQ ? "Nenhum resultado." : "Digite para buscar."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
