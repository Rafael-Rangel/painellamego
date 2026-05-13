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
  onChange
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

  return (
    <div className="field ms-root" ref={rootRef}>
      <label>{label}</label>
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
            {filtered.length ? (
              filtered.map((opt) => (
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
              ))
            ) : (
              <p className="empty" style={{ margin: 0, padding: "0.6rem 0.7rem" }}>
                Sem opções salvas. Digite para criar.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
