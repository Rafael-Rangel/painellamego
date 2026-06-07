export function monthKeyFromDate(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

export function purchaseDateFromInstallmentRow(row) {
  const purchase = Array.isArray(row?.purchases) ? row.purchases[0] : row?.purchases;
  const items = purchase?.purchase_items || [];
  const dates = items.map((i) => i.purchase_date).filter(Boolean).sort();
  return dates[0] || null;
}

/**
 * Agrega parcelas pendentes vs compras do período (compromisso x fluxo de caixa).
 * @param {Array} installmentRows parcelas pending com join em purchases/purchase_items
 * @param {{ fromStr: string, toStr: string, granularity: string, buildLabels: () => string[] }} range
 * @param {Array<{ label: string, amount: number }>} spendByBucket
 */
export function buildCashFlowMetrics(installmentRows = [], range, spendByBucket = []) {
  let dueInPeriod = 0;
  let dueFromEarlierPurchases = 0;
  const dueByMonth = new Map();

  if (range.granularity === "month") {
    for (const label of range.buildLabels()) {
      dueByMonth.set(label, { dueAmount: 0, dueFromEarlier: 0, count: 0 });
    }
  }

  for (const row of installmentRows) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;

    const dueMonth = monthKeyFromDate(row.due_date);
    const purchaseDate = purchaseDateFromInstallmentRow(row);
    const purchaseMonth = monthKeyFromDate(purchaseDate);

    dueInPeriod += amount;
    if (purchaseDate && purchaseDate < range.fromStr) {
      dueFromEarlierPurchases += amount;
    }

    if (range.granularity === "month" && !dueByMonth.has(dueMonth)) continue;

    const bucketKey = range.granularity === "month" ? dueMonth : "period";
    if (!dueByMonth.has(bucketKey)) {
      dueByMonth.set(bucketKey, { dueAmount: 0, dueFromEarlier: 0, count: 0 });
    }
    const acc = dueByMonth.get(bucketKey);
    acc.dueAmount += amount;
    acc.count += 1;
    if (purchaseMonth && purchaseMonth < dueMonth) {
      acc.dueFromEarlier += amount;
    }
  }

  const monthly =
    range.granularity === "month"
      ? spendByBucket.map((b) => {
          const due = dueByMonth.get(b.label) || { dueAmount: 0, dueFromEarlier: 0, count: 0 };
          return {
            month: b.label,
            purchasedAmount: Number(b.amount) || 0,
            dueAmount: due.dueAmount,
            dueFromEarlierPurchases: due.dueFromEarlier,
            dueInstallmentsCount: due.count
          };
        })
      : [];

  return {
    dueInPeriod: roundMoney(dueInPeriod),
    dueInstallmentsCount: installmentRows.length,
    dueFromEarlierPurchases: roundMoney(dueFromEarlierPurchases),
    monthly
  };
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}
