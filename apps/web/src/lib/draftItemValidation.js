import { isBonificationOnlyLine, parseBrNumber } from "./purchaseTotals";

function resolveItemCategory(row, productList) {
  const explicit = String(row?.category || "").trim();
  if (explicit.length >= 2) return explicit;
  if (row?.productId) {
    const p = (productList || []).find((x) => x.id === row.productId);
    const fromProduct = String(p?.category || "").trim();
    if (fromProduct.length >= 2) return fromProduct;
  }
  return "";
}

/** Erros por campo do formulário de item (true = inválido). */
export function getDraftItemFieldErrors(draftItem, products) {
  const category = resolveItemCategory(draftItem, products);
  const qty = parseBrNumber(draftItem?.quantity);
  const price = parseBrNumber(draftItem?.unitPrice);
  const bonusQty = parseBrNumber(draftItem?.bonusQuantity) || 0;
  const bonusVal = parseBrNumber(draftItem?.bonusUnitValue) || 0;
  const bonusOnly = isBonificationOnlyLine(draftItem);

  return {
    category: !category,
    product: !draftItem?.productId,
    quantity: bonusOnly ? bonusQty <= 0 && (!Number.isFinite(qty) || qty <= 0) : !Number.isFinite(qty) || qty <= 0,
    unitPrice: bonusOnly
      ? !Number.isFinite(bonusVal) || bonusVal <= 0
      : !Number.isFinite(price) || price <= 0
  };
}
