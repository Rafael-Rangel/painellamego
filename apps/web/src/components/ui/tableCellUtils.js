const NON_CLAMP_COLUMN_IDS = new Set(["actions", "sel", "lineType", "share_store"]);

export function shouldClampColumn(col) {
  if (col.clamp === false) return false;
  if (col.clamp === true) return true;
  if (NON_CLAMP_COLUMN_IDS.has(col.id)) return false;
  if (col.kind === "actions" || col.kind === "controls") return false;
  return true;
}

export function inferCellTitle(row, col) {
  if (typeof col.getTitle === "function") return col.getTitle(row);
  const v = row[col.id];
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (col.id === "stores" && row.stores?.length) {
    return row.stores.map((s) => s.name).filter(Boolean).join(", ");
  }
  if (col.id === "label_raw") return row.label_raw || row.label_normalized || "";
  if (col.id === "supplier" && row.purchase_items?.length) {
    return row.purchase_items.map((it) => it.suppliers?.name).filter(Boolean).join(", ");
  }
  if (col.id === "items" && row.purchase_items?.length) {
    return summarizePurchaseItems(row.purchase_items, 12);
  }
  if (col.id === "productId") {
    return row.aiRawProductName || row.productName || "";
  }
  const named = row.product_name ?? row.supplier_name ?? row.store_name ?? row.managerName ?? row.email ?? row.name;
  if (named != null && col.id !== "actions") return String(named);
  return undefined;
}

export function summarizePurchaseItems(items, maxParts = 8) {
  if (!items?.length) return "";
  const parts = items.slice(0, maxParts).map((it) => {
    const name = it.products?.name || it.product_id || "Item";
    const short = name.length > 28 ? `${name.slice(0, 26)}…` : name;
    const tipo = it.line_type === "venda" ? " (venda)" : it.line_type === "insumo" ? " (insumo)" : "";
    return `${short} ${it.quantity}×${tipo}`;
  });
  const extra = items.length > maxParts ? ` +${items.length - maxParts}` : "";
  return parts.join(" · ") + extra;
}
