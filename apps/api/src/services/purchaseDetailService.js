import { purchaseInvoiceSummary } from "@lamego/shared";
import { supabaseAdmin } from "../lib/supabase.js";

function relOne(row) {
  return Array.isArray(row) ? row[0] : row;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapItemRow(item) {
  const product = relOne(item.products);
  const supplier = relOne(item.suppliers);
  const isBonus = Boolean(item.is_bonification_only);
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const bonusQty = Number(item.bonus_quantity) || 0;
  const bonusVal = Number(item.bonus_unit_value) || 0;

  let chargeTotal = isBonus ? 0 : qty * price;
  let bonusRefTotal = 0;
  if (isBonus) {
    if (bonusQty > 0 && bonusVal > 0) bonusRefTotal = bonusQty * bonusVal;
    else if (qty > 0 && (price > 0 || bonusVal > 0)) bonusRefTotal = qty * (bonusVal > 0 ? bonusVal : price);
  } else {
    bonusRefTotal = bonusQty * bonusVal;
  }

  return {
    id: item.id,
    productId: item.product_id,
    productName: product?.name || "Produto",
    category: product?.category || null,
    productType: product?.type || item.line_type || null,
    standardUnit: product?.standard_unit || null,
    supplierName: supplier?.name || null,
    lineType: item.line_type || "insumo",
    isBonificationOnly: isBonus,
    quantity: qty,
    unitUsed: item.unit_used,
    unitPrice: price,
    chargeTotal: Math.round(chargeTotal * 100) / 100,
    bonusQuantity: bonusQty,
    bonusUnitValue: bonusVal,
    bonusRefTotal: Math.round(bonusRefTotal * 100) / 100,
    purchaseDate: item.purchase_date,
    weekOfMonth: item.week_of_month
  };
}

export async function getPurchaseDetail(purchaseId) {
  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select(
      `
      *,
      stores(id, name, store_number, location),
      purchase_items(
        *,
        products(id, name, category, type, standard_unit),
        suppliers(name)
      ),
      fiscal_receipts(id, original_name, mime_type, storage_path, created_at),
      purchase_payment_installments(installment_number, due_date, amount, status, notes, paid_at)
    `
    )
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const store = relOne(data.stores);
  const items = (data.purchase_items || []).map(mapItemRow).sort((a, b) => {
    const da = a.purchaseDate || "";
    const db = b.purchaseDate || "";
    return da.localeCompare(db) || String(a.productName).localeCompare(String(b.productName), "pt-BR");
  });

  const summaryItems = items.map((row) => ({
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    isBonificationOnly: row.isBonificationOnly,
    bonusQuantity: row.bonusQuantity,
    bonusUnitValue: row.bonusUnitValue
  }));

  const taxes = parseJsonArray(data.taxes_json).map((row) => ({
    name: String(row?.name || "").trim(),
    amount: Number(row?.amount) || 0
  }));
  const extras = parseJsonArray(data.extras_json).map((row) => ({
    name: String(row?.name || "").trim(),
    amount: Number(row?.amount) || 0
  }));

  const computed = purchaseInvoiceSummary(summaryItems, taxes, extras);
  const storedPayable = data.total_payable != null ? Number(data.total_payable) : null;
  const storedBonus = data.total_bonus_value != null ? Number(data.total_bonus_value) : null;
  const storedTaxes = data.total_taxes != null ? Number(data.total_taxes) : null;
  const storedExtras = data.total_extras != null ? Number(data.total_extras) : null;
  const storedGrand = data.grand_total != null ? Number(data.grand_total) : null;

  const totals = {
    totalPayable: storedPayable ?? computed.totalPayable,
    totalBonusValue: storedBonus ?? computed.totalBonusValue,
    totalTaxes: storedTaxes ?? computed.totalTaxes,
    totalExtras: storedExtras ?? computed.totalExtras,
    grandTotal: storedGrand ?? computed.grandTotal
  };

  const supplierName =
    items.find((i) => i.supplierName)?.supplierName ||
    relOne(data.purchase_items?.[0]?.suppliers)?.name ||
    null;

  const receipts = [];
  for (const rec of data.fiscal_receipts || []) {
    let url = null;
    if (rec.storage_path) {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("fiscal-receipts")
        .createSignedUrl(rec.storage_path, 3600);
      if (!signErr) url = signed?.signedUrl || null;
    }
    receipts.push({
      id: rec.id,
      originalName: rec.original_name,
      mimeType: rec.mime_type,
      createdAt: rec.created_at,
      url
    });
  }

  const installments = (data.purchase_payment_installments || [])
    .slice()
    .sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0))
    .map((row) => ({
      number: row.installment_number,
      dueDate: row.due_date,
      amount: Number(row.amount) || 0,
      status: row.status,
      notes: row.notes || "",
      paidAt: row.paid_at
    }));

  return {
    id: data.id,
    invoiceNumber: data.invoice_number,
    createdAt: data.created_at,
    store: store
      ? {
          id: store.id,
          name: store.name,
          storeNumber: store.store_number,
          location: store.location
        }
      : null,
    supplierName,
    notes: data.notes || "",
    taxes,
    extras,
    totals,
    items,
    installments,
    receipts
  };
}
