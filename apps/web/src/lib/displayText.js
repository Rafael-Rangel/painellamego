/** Valor exibido quando não há dado (sem travessão). */
export const EMPTY_DISPLAY = "n/d";

const DOC_MONEY_TOLERANCE = 0.05;

export function formatStoreReadonly(overview, user) {
  if (overview === undefined) return "Carregando…";
  if (overview?.storeCode != null) {
    return `Código ${overview.storeCode} · ${overview.storeName ?? "Sua loja"}`;
  }
  if (user?.storeId) return "Loja vinculada ao seu acesso";
  return EMPTY_DISPLAY;
}

/** Mostra bloco de totais da NF só quando total da compra ≠ total dos produtos. */
export function shouldShowReceiptTotalDifference(documentTotals) {
  if (!documentTotals) return false;
  const products = Number(documentTotals.productsSubtotal);
  const purchase = Number(documentTotals.documentTotal);
  if (!Number.isFinite(products) || !Number.isFinite(purchase)) return false;
  return Math.abs(products - purchase) > DOC_MONEY_TOLERANCE;
}

export function buildReceiptTotalDifferenceRows(documentTotals, formatCurrency) {
  if (!shouldShowReceiptTotalDifference(documentTotals)) return [];
  const products = Number(documentTotals.productsSubtotal);
  const purchase = Number(documentTotals.documentTotal);
  return [
    { label: "Total dos Produtos", value: formatCurrency(products) },
    { label: "Total da Compra", value: formatCurrency(purchase) }
  ];
}
