import {
  isBonificationOnlyLine,
  parseBrNumber,
  purchaseTotalsFromItems,
  hasChargeablePurchaseContent,
  validateInstallmentsAgainstPayable
} from "@lamego/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { recalculateProductSnapshot } from "./comparisonService.js";

export async function deletePurchaseCascade(purchaseId) {
  if (!purchaseId) return;
  await supabaseAdmin.from("purchases").delete().eq("id", purchaseId);
}

function mapItemToRow(item, purchaseId, storeId) {
  const isBonusOnly = isBonificationOnlyLine(item);
  let quantity = parseBrNumber(item.quantity) || 0;
  let unitPrice = parseBrNumber(item.unitPrice) || 0;
  let bonusQuantity = parseBrNumber(item.bonusQuantity) || 0;
  let bonusUnitValue = parseBrNumber(item.bonusUnitValue) || 0;

  if (isBonusOnly) {
    if (bonusQuantity <= 0) bonusQuantity = quantity;
    quantity = 0;
    unitPrice = 0;
    if (bonusUnitValue <= 0) bonusUnitValue = parseBrNumber(item.unitPrice) || 0;
  }

  return {
    purchase_id: purchaseId,
    store_id: storeId,
    product_id: item.productId,
    supplier_id: item.supplierId,
    unit_price: unitPrice,
    unit_used: item.unitUsed,
    quantity,
    purchase_date: item.purchaseDate,
    week_of_month: item.weekOfMonth,
    line_type: item.lineType,
    bonus_quantity: bonusQuantity,
    bonus_unit_value: bonusUnitValue,
    is_bonification_only: isBonusOnly
  };
}

/**
 * Cria compra finalizada com itens, parcelas e anexos (buffers).
 * @returns {{ purchaseId: string }}
 */
export async function finalizePurchase({
  storeId,
  userId,
  invoiceNumber,
  items,
  installments,
  receiptFiles,
  draftId = null
}) {
  const { totalPayable, totalBonusValue } = purchaseTotalsFromItems(items);

  if (!hasChargeablePurchaseContent(items)) {
    const err = new Error(
      "O total da nota está zerado. Informe quantidade e preço unitário em pelo menos um item."
    );
    err.statusCode = 400;
    throw err;
  }

  let inst = installments || [];
  if (!inst.length) {
    inst = [{ dueDate: items[0]?.purchaseDate, amount: totalPayable, notes: "Único vencimento" }];
  }

  const instCheck = validateInstallmentsAgainstPayable(inst, totalPayable);
  if (!instCheck.ok && totalPayable > 0) {
    const err = new Error(
      `A soma das parcelas (R$ ${instCheck.sum}) não confere com o total da nota (R$ ${totalPayable}). Ajuste os vencimentos.`
    );
    err.statusCode = 400;
    throw err;
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .insert({
      store_id: storeId,
      invoice_number: String(invoiceNumber).trim(),
      created_by: userId,
      draft_id: draftId,
      total_payable: totalPayable,
      total_bonus_value: totalBonusValue
    })
    .select("id")
    .single();

  if (purchaseError) {
    const msg = String(purchaseError.message || "");
    if (msg.toLowerCase().includes("unique_invoice") || msg.toLowerCase().includes("duplicate")) {
      const err = new Error("Já existe uma compra com este número de nota nesta loja.");
      err.statusCode = 400;
      throw err;
    }
    const err = new Error(purchaseError.message);
    err.statusCode = 400;
    throw err;
  }

  const purchaseId = purchase.id;
  const payloadItems = items.map((item) => mapItemToRow(item, purchaseId, storeId));

  const { error: itemsError } = await supabaseAdmin.from("purchase_items").insert(payloadItems);
  if (itemsError) {
    await deletePurchaseCascade(purchaseId);
    const err = new Error(itemsError.message);
    err.statusCode = 400;
    throw err;
  }

  const instRows = inst.map((row, idx) => ({
    purchase_id: purchaseId,
    store_id: storeId,
    installment_number: idx + 1,
    due_date: row.dueDate,
    amount: Number(row.amount),
    notes: row.notes || null
  }));

  const { error: instError } = await supabaseAdmin.from("purchase_payment_installments").insert(instRows);
  if (instError) {
    await deletePurchaseCascade(purchaseId);
    const err = new Error(instError.message);
    err.statusCode = 400;
    throw err;
  }

  /** Ao publicar a NF, a 1ª parcela costuma já estar paga; não entra no Financeiro. */
  if (instRows.length > 0) {
    const { error: paidFirstError } = await supabaseAdmin
      .from("purchase_payment_installments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("purchase_id", purchaseId)
      .eq("installment_number", 1);
    if (paidFirstError) {
      await deletePurchaseCascade(purchaseId);
      const err = new Error(paidFirstError.message);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const file of receiptFiles || []) {
    const safeName = String(file.originalname || "nota").replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
    const filePath = `${purchaseId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("fiscal-receipts")
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) {
      await deletePurchaseCascade(purchaseId);
      const err = new Error(uploadError.message);
      err.statusCode = 400;
      throw err;
    }
    const { error: receiptRowError } = await supabaseAdmin.from("fiscal_receipts").insert({
      purchase_id: purchaseId,
      storage_path: filePath,
      original_name: file.originalname,
      mime_type: file.mimetype
    });
    if (receiptRowError) {
      await supabaseAdmin.storage.from("fiscal-receipts").remove([filePath]);
      await deletePurchaseCascade(purchaseId);
      const err = new Error(receiptRowError.message);
      err.statusCode = 400;
      throw err;
    }
  }

  const productIds = [...new Set(payloadItems.map((row) => row.product_id))];
  for (const pid of productIds) {
    await recalculateProductSnapshot(pid);
  }

  if (draftId) {
    await supabaseAdmin.from("purchase_drafts").update({ status: "finalized" }).eq("id", draftId);
  }

  return { purchaseId, totalPayable, totalBonusValue };
}
