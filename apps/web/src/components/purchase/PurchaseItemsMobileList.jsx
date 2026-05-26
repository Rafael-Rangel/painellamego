import SingleSelectInput from "../ui/SingleSelectInput";
import EmptyState from "../ui/EmptyState";
import { LineTypePicker } from "./PurchaseDraftItemForm";
import { formatCurrency } from "../../lib/formatters";
import { lineChargeAmount } from "../../lib/purchaseTotals";

export default function PurchaseItemsMobileList({
  items,
  products,
  categoryOptions,
  updateItem,
  onNotify,
  emptyMessage
}) {
  if (!items?.length) {
    return <EmptyState message={emptyMessage} compact />;
  }

  return (
    <ul className="purchase-items-mobile" aria-label="Itens adicionados">
      {items.map((item, idx) => {
        const productName =
          products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || "Produto";
        const category =
          item.category || products.find((p) => p.id === item.productId)?.category || "";
        const lineTotal = lineChargeAmount(item);

        return (
          <li key={`${item.productId || item.aiRawProductName || "row"}-${idx}`} className="purchase-item-card">
            <header className="purchase-item-card__head">
              <div className="purchase-item-card__title-wrap">
                <strong className="purchase-item-card__name">{productName}</strong>
                {category ? <span className="purchase-item-card__category">{category}</span> : null}
              </div>
              <span className="purchase-item-card__total">{formatCurrency(lineTotal)}</span>
            </header>

            <div className="purchase-item-card__field">
              <span className="purchase-item-card__label">Categoria</span>
              <SingleSelectInput
                placeholder="Categoria…"
                options={categoryOptions}
                value={item.category || ""}
                onChange={(next) => updateItem(idx, { category: next })}
                createEntityLabel="categoria"
                catalogField="category"
                onNotify={onNotify}
              />
            </div>

            <div className="purchase-item-card__field">
              <span className="purchase-item-card__label">Insumo ou venda</span>
              <LineTypePicker
                name={`mobile-item-line-${idx}`}
                value={item.lineType === "venda" ? "venda" : "insumo"}
                onChange={(lineType) => updateItem(idx, { lineType })}
              />
            </div>

            <div className="purchase-item-card__metrics">
              <div className="purchase-item-card__metric">
                <span className="purchase-item-card__label">Qtd</span>
                <span className="purchase-item-card__value">{item.quantity}</span>
              </div>
              <div className="purchase-item-card__metric">
                <span className="purchase-item-card__label">Unid.</span>
                <span className="purchase-item-card__value">{item.unitUsed}</span>
              </div>
              <div className="purchase-item-card__metric">
                <span className="purchase-item-card__label">Valor un.</span>
                <span className="purchase-item-card__value">{formatCurrency(item.unitPrice)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
