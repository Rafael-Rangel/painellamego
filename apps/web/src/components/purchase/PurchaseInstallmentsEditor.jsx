import { WizardAlert } from "../ui/WizardAlert";
import { formatCurrency } from "../../lib/formatters";
import { purchaseTotalsFromItems, validateInstallmentsAgainstPayable } from "../../lib/purchaseTotals";

export default function PurchaseInstallmentsEditor({ items, installments, onChange, purchaseDate, showValidation = false }) {
  const { totalPayable } = purchaseTotalsFromItems(items);
  const check = validateInstallmentsAgainstPayable(installments, totalPayable);

  const splitEqual = (parts) => {
    if (!parts || parts < 2) return;
    const each = Math.round((totalPayable / parts) * 100) / 100;
    const rows = [];
    let sum = 0;
    for (let i = 0; i < parts; i += 1) {
      const amt = i === parts - 1 ? Math.round((totalPayable - sum) * 100) / 100 : each;
      sum += amt;
      rows.push({
        dueDate: purchaseDate || "",
        amount: amt,
        notes: `Parcela ${i + 1}`
      });
    }
    onChange(rows);
  };

  const addRow = () => {
    const nextCount = installments.length + 1;
    if (nextCount === 2 && totalPayable > 0) {
      splitEqual(2);
      return;
    }
    onChange([
      ...installments,
      {
        dueDate: purchaseDate || "",
        amount: nextCount === 1 && totalPayable > 0 ? totalPayable : "",
        notes: `Parcela ${nextCount}`
      }
    ]);
  };

  const updateRow = (idx, patch) => {
    onChange(installments.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx) => {
    onChange(installments.filter((_, i) => i !== idx));
  };

  return (
    <div className="purchase-installments">
      <div className="purchase-installments__head">
        <p className="wizard-panel-desc" style={{ margin: 0 }}>
          Total a pagar da nota: <strong>{formatCurrency(totalPayable)}</strong>
        </p>
        <div className="purchase-installments__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => splitEqual(2)}>
            Dividir em 2
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([{ dueDate: purchaseDate || "", amount: totalPayable, notes: "Único vencimento" }])}>
            Vencimento único
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
            + Vencimento
          </button>
        </div>
      </div>

      {!installments.length ? (
        <p className="field-helper">Sem parcelas definidas: ao confirmar será criado um vencimento único com o total.</p>
      ) : null}

      <ul className="purchase-installments__list">
        {installments.map((row, idx) => (
          <li key={idx} className="purchase-installment-row">
            <div className="field field-wizard">
              <label>Vencimento {idx + 1}</label>
              <input type="date" value={row.dueDate || ""} onChange={(e) => updateRow(idx, { dueDate: e.target.value })} />
            </div>
            <div className="field field-wizard">
              <label>Valor (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.amount}
                onChange={(e) => updateRow(idx, { amount: e.target.value })}
              />
            </div>
            <button type="button" className="btn btn-ghost btn-sm purchase-installment-row__remove" onClick={() => removeRow(idx)} aria-label="Remover parcela">
              ×
            </button>
          </li>
        ))}
      </ul>

      {showValidation && installments.length > 0 && !check.ok && totalPayable > 0 ? (
        <WizardAlert type="error">
          Soma das parcelas ({formatCurrency(check.sum)}) difere do total ({formatCurrency(totalPayable)}). Ajuste os
          valores ou use «Dividir em 2» antes de continuar.
        </WizardAlert>
      ) : null}
    </div>
  );
}
