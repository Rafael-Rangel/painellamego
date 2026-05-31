import PurchaseNamedAmountListEditor from "./PurchaseNamedAmountListEditor";
import { purchaseInvoiceSummary } from "../../lib/purchaseTotals";
import { formatCurrency } from "../../lib/formatters";

export default function PurchaseAdjustmentsEditor({
  items,
  taxes,
  extras,
  notes,
  onTaxesChange,
  onExtrasChange,
  onNotesChange
}) {
  const summary = purchaseInvoiceSummary(items, taxes, extras);

  return (
    <div className="purchase-adjustments">
      <PurchaseNamedAmountListEditor
        title="Impostos"
        addLabel="+ Adicionar Imposto"
        removeLabel="Remover Imposto"
        emptyHint="Opcional. Use «+ Adicionar Imposto» para incluir ISS, ICMS, taxas etc."
        rows={taxes}
        onChange={onTaxesChange}
        namePlaceholder="Nome do Imposto"
        amountLabel="Valor do Imposto (R$)"
      />

      <PurchaseNamedAmountListEditor
        title="Extras"
        addLabel="+ Adicionar Extra"
        removeLabel="Remover Extra"
        emptyHint="Opcional. Use «+ Adicionar Extra» para frete, taxas emergenciais etc."
        rows={extras}
        onChange={onExtrasChange}
        namePlaceholder="Descrição / Nome do Extra"
        amountLabel="Valor (R$)"
      />

      <section className="purchase-adjustments-notes" aria-label="Observações">
        <div className="field field-wizard">
          <label htmlFor="purchase-notes">OBS / Observações</label>
          <textarea
            id="purchase-notes"
            rows={4}
            value={notes || ""}
            placeholder="Informações adicionais, justificativas, detalhes da cobrança ou observações internas."
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>
      </section>

      <aside className="purchase-invoice-summary purchase-invoice-summary--compact" aria-label="Resumo parcial">
        <h4 className="purchase-invoice-summary__title">Resumo parcial</h4>
        <dl>
          <div>
            <dt>Produtos sem bonificação</dt>
            <dd>{formatCurrency(summary.totalPayable)}</dd>
          </div>
          <div>
            <dt>Produtos com bonificação (referência)</dt>
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
      </aside>
    </div>
  );
}
