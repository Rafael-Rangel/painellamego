import { useEffect, useMemo, useRef, useState } from "react";

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function MultiSelectSearch({
  label,
  placeholder = "Digite para filtrar...",
  options = [],
  value = [],
  onChange,
  maxChips = 2
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);

  const selectedSet = useMemo(() => new Set(value || []), [value]);
  const filtered = useMemo(() => {
    const nq = normalize(q);
    const list = options || [];
    if (!nq) return list.slice(0, 30);
    return list
      .filter((o) => normalize(o.label).includes(nq))
      .slice(0, 30);
  }, [options, q]);

  const selectedOptions = useMemo(() => {
    const map = new Map((options || []).map((o) => [o.value, o]));
    return (value || []).map((v) => map.get(v)).filter(Boolean);
  }, [options, value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggle(v) {
    const curr = new Set(value || []);
    if (curr.has(v)) curr.delete(v);
    else curr.add(v);
    onChange(Array.from(curr));
  }

  function remove(v) {
    onChange((value || []).filter((x) => x !== v));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="field field-styled ms-root" ref={rootRef}>
      <label>{label}</label>
      <button type="button" className="ms-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="ms-trigger-text">
          {selectedOptions.length ? (
            <span className="ms-chips">
              {selectedOptions.slice(0, maxChips).map((o) => (
                <span key={o.value} className="ms-chip" title={o.label}>
                  <span className="ms-chip-label">{o.label}</span>
                  <span
                    className="ms-chip-x"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(o.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(o.value);
                      }
                    }}
                  >
                    ×
                  </span>
                </span>
              ))}
              {selectedOptions.length > maxChips ? <span className="ms-chip ms-chip-more">+{selectedOptions.length - maxChips}</span> : null}
            </span>
          ) : (
            <span className="ms-placeholder">{placeholder}</span>
          )}
        </span>
        <span className="ms-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="ms-popover" role="listbox">
          <div className="ms-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
            <button type="button" className="btn btn-ghost ms-clear" onClick={clearAll} disabled={!selectedOptions.length}>
              Limpar
            </button>
          </div>

          <div className="ms-options">
            {filtered.length ? (
              filtered.map((o) => (
                <label key={o.value} className="ms-option">
                  <input type="checkbox" checked={selectedSet.has(o.value)} onChange={() => toggle(o.value)} />
                  <span>{o.label}</span>
                </label>
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

