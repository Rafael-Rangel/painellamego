import { formatCurrency } from "../../lib/formatters";
import { purchaseInvoiceSummary } from "../../lib/purchaseTotals";

export default function PurchaseInvoiceSummary({ items, taxes, extras, notes, compact = false }) {
  const summary = purchaseInvoiceSummary(items, taxes, extras);
  const className = compact
    ? "purchase-invoice-summary purchase-invoice-summary--compact"
    : "purchase-invoice-summary";

  return (
    <aside className={className} aria-label="Resumo da nota">
      <h4 className="purchase-invoice-summary__title">{compact ? "Resumo parcial" : "Resumo final"}</h4>
      <dl>
        <div>
          <dt>Valor Total dos Produtos sem bonificação</dt>
          <dd>{formatCurrency(summary.totalPayable)}</dd>
        </div>
        <div>
          <dt>Valor Total dos Produtos com bonificação</dt>
          <dd>{formatCurrency(summary.totalBonusValue)}</dd>
        </div>
        <div>
          <dt>Total de Impostos</dt>
          <dd>{formatCurrency(summary.totalTaxes)}</dd>
        </div>
        <div>
          <dt>Total de Extras</dt>
          <dd>{formatCurrency(summary.totalExtras)}</dd>
        </div>
        <div className="purchase-invoice-summary__grand">
          <dt>Valor Total da Nota</dt>
          <dd>{formatCurrency(summary.grandTotal)}</dd>
        </div>
      </dl>

      {summary.totalTaxes > 0 && taxes?.length ? (
        <>
          <h5 className="purchase-invoice-summary__sub">Impostos</h5>
          <ul className="purchase-invoice-summary__lines">
            {taxes
              .filter((row) => String(row?.name || "").trim() || Number(row?.amount) > 0)
              .map((row, idx) => (
                <li key={`tax-${idx}`}>
                  <span>{String(row.name || "Imposto").trim()}</span>
                  <strong>{formatCurrency(Number(row.amount) || 0)}</strong>
                </li>
              ))}
          </ul>
        </>
      ) : null}

      {summary.totalExtras > 0 && extras?.length ? (
        <>
          <h5 className="purchase-invoice-summary__sub">Extras</h5>
          <ul className="purchase-invoice-summary__lines">
            {extras
              .filter((row) => String(row?.name || "").trim() || Number(row?.amount) > 0)
              .map((row, idx) => (
                <li key={`extra-${idx}`}>
                  <span>{String(row.name || "Extra").trim()}</span>
                  <strong>{formatCurrency(Number(row.amount) || 0)}</strong>
                </li>
              ))}
          </ul>
        </>
      ) : null}

      {notes?.trim() ? (
        <div className="purchase-invoice-summary__notes">
          <h5 className="purchase-invoice-summary__sub">Observações</h5>
          <p>{notes.trim()}</p>
        </div>
      ) : null}
    </aside>
  );
}
