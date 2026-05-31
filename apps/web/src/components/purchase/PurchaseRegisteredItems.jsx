import { FaEdit, FaTrash } from "react-icons/fa";
import EmptyState from "../ui/EmptyState";
import { LineTypePicker } from "./PurchaseDraftItemForm";
import SingleSelectInput from "../ui/SingleSelectInput";
import { formatCurrency } from "../../lib/formatters";
import { isBonificationOnlyLine, lineDisplayAmount } from "../../lib/purchaseTotals";

export default function PurchaseRegisteredItems({
  items,
  products,
  categoryOptions,
  editingIndex,
  updateItem,
  onEdit,
  onDelete,
  onNotify,
  emptyMessage
}) {
  if (!items?.length) {
    return (
      <div className="purchase-items-empty">
        <EmptyState message={emptyMessage} compact />
        <p className="purchase-items-empty__hint">Preencha o formulário e toque em «Adicionar item».</p>
      </div>
    );
  }

  return (
    <div className="purchase-registered-items">
      <header className="purchase-registered-items__head">
        <h4 className="purchase-registered-items__title">Itens na nota</h4>
        <span className="purchase-registered-items__count">{items.length} item(ns)</span>
      </header>
      <ul className="purchase-items-list" aria-label="Itens adicionados">
        {items.map((item, idx) => {
          const productName =
            products.find((p) => p.id === item.productId)?.name || item.aiRawProductName || "Produto";
          const category = item.category || products.find((p) => p.id === item.productId)?.category || "";
          const bonusOnly = isBonificationOnlyLine(item);
          const lineTotal = lineDisplayAmount(item);
          const isEditing = editingIndex === idx;

          return (
            <li
              key={`${item.productId || item.aiRawProductName || "row"}-${idx}`}
              className={`purchase-item-card ${isEditing ? "purchase-item-card--editing" : ""}`}
            >
              <header className="purchase-item-card__head">
                <div className="purchase-item-card__title-wrap">
                  <strong className="purchase-item-card__name">{productName}</strong>
                  {category ? <span className="purchase-item-card__category">{category}</span> : null}
                  <span className="purchase-item-card__type-pill">
                    {item.lineType === "venda" ? "Venda" : "Insumo"}
                    {bonusOnly ? " · Produto de bonificação" : ""}
                  </span>
                </div>
                <span className={`purchase-item-card__total${bonusOnly ? " purchase-item-card__total--bonus" : ""}`}>
                  {bonusOnly ? <span className="purchase-item-card__total-label">Ref.</span> : null}
                  {formatCurrency(lineTotal)}
                </span>
              </header>

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
                  <span className="purchase-item-card__label">{bonusOnly ? "Valor ref." : "Valor un."}</span>
                  <span className="purchase-item-card__value">{formatCurrency(item.unitPrice)}</span>
                </div>
              </div>

              <div className="purchase-item-card__field purchase-item-card__field--mobile-edit">
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

              <div className="purchase-item-card__field purchase-item-card__field--mobile-edit">
                <span className="purchase-item-card__label">Tipo</span>
                <LineTypePicker
                  name={`item-line-${idx}`}
                  value={item.lineType === "venda" ? "venda" : "insumo"}
                  onChange={(lineType) => updateItem(idx, { lineType })}
                />
              </div>

              <div className="purchase-item-card__actions">
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm purchase-item-card__btn ${isEditing ? "purchase-item-card__btn--active" : ""}`}
                  onClick={() => onEdit(idx)}
                  aria-pressed={isEditing}
                >
                  <FaEdit aria-hidden />
                  {isEditing ? "A editar acima" : "Editar"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm purchase-item-card__btn purchase-item-card__btn--danger"
                  onClick={() => onDelete(idx, productName)}
                >
                  <FaTrash aria-hidden />
                  Excluir
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
