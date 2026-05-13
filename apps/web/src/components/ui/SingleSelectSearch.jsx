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
  onChange
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

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="field field-styled ms-root" ref={rootRef}>
      <label>{label}</label>
      <input
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
            {filtered.length ? (
              filtered.map((o) => (
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
              ))
            ) : (
              <p className="empty" style={{ margin: 0, padding: "0.6rem 0.7rem" }}>
                Nenhum resultado.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
