import { formatCurrency } from "../../lib/formatters";
import { parseBrNumber, sumAdjustmentLines } from "../../lib/purchaseTotals";

function rowHasContent(row) {
  return String(row?.name || "").trim().length > 0 || parseBrNumber(row?.amount) > 0;
}

export default function PurchaseNamedAmountListEditor({
  title,
  addLabel,
  emptyHint,
  rows,
  onChange,
  namePlaceholder = "Descrição",
  amountLabel = "Valor (R$)"
}) {
  const total = sumAdjustmentLines(rows.filter(rowHasContent));

  const addRow = () => {
    onChange([...rows, { name: "", amount: "" }]);
  };

  const updateRow = (idx, patch) => {
    onChange(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const visibleRows = rows.length ? rows : [];

  return (
    <section className="purchase-adjustments-block" aria-label={title}>
      <div className="purchase-adjustments-block__head">
        <h4 className="purchase-adjustments-block__title">{title}</h4>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          {addLabel}
        </button>
      </div>

      {!visibleRows.length ? (
        <p className="field-helper">{emptyHint}</p>
      ) : (
        <>
          <ul className="purchase-adjustments-block__list">
            {visibleRows.map((row, idx) => (
              <li key={idx} className="purchase-adjustment-row">
                <div className="field field-wizard">
                  <label>{namePlaceholder}</label>
                  <input
                    type="text"
                    value={row.name || ""}
                    placeholder={namePlaceholder}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                </div>
                <div className="field field-wizard">
                  <label>{amountLabel}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount ?? ""}
                    onChange={(e) => updateRow(idx, { amount: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm purchase-adjustment-row__remove"
                  onClick={() => removeRow(idx)}
                  aria-label={`Remover ${row.name || "linha"}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {visibleRows.filter(rowHasContent).length ? (
            <ul className="purchase-adjustments-block__detail" aria-label={`Detalhe de ${title}`}>
              {visibleRows.filter(rowHasContent).map((row, idx) => (
                <li key={`${row.name}-${idx}`}>
                  <span>{String(row.name || "Sem nome").trim()}</span>
                  <strong>{formatCurrency(parseBrNumber(row.amount) || 0)}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {total > 0 ? (
        <p className="purchase-adjustments-block__total">
          Total de {title}: <strong>{formatCurrency(total)}</strong>
        </p>
      ) : null}
    </section>
  );
}
