import test from "node:test";
import assert from "node:assert/strict";
import { buildCashFlowMetrics, purchaseDateFromInstallmentRow } from "../src/lib/cashFlowMetrics.js";

const mayRange = {
  fromStr: "2026-05-01",
  toStr: "2026-05-31",
  granularity: "month",
  buildLabels() {
    return ["2026-05"];
  }
};

test("purchaseDateFromInstallmentRow: usa a menor data dos itens", () => {
  const d = purchaseDateFromInstallmentRow({
    purchases: {
      purchase_items: [{ purchase_date: "2026-05-26" }, { purchase_date: "2026-05-25" }]
    }
  });
  assert.equal(d, "2026-05-25");
});

test("buildCashFlowMetrics: boleto de maio que vence em junho entra em dueFromEarlier no período de junho", () => {
  const juneRange = {
    fromStr: "2026-06-01",
    toStr: "2026-06-30",
    granularity: "month",
    buildLabels() {
      return ["2026-06"];
    }
  };
  const metrics = buildCashFlowMetrics(
    [
      {
        due_date: "2026-06-03",
        amount: 20000,
        purchases: { purchase_items: [{ purchase_date: "2026-05-26" }] }
      }
    ],
    juneRange,
    [{ label: "2026-06", amount: 5000 }]
  );
  assert.equal(metrics.dueInPeriod, 20000);
  assert.equal(metrics.dueFromEarlierPurchases, 20000);
  assert.equal(metrics.monthly[0].purchasedAmount, 5000);
  assert.equal(metrics.monthly[0].dueAmount, 20000);
  assert.equal(metrics.monthly[0].dueFromEarlierPurchases, 20000);
});

test("buildCashFlowMetrics: compra e vencimento no mesmo mês não conta como anterior", () => {
  const metrics = buildCashFlowMetrics(
    [
      {
        due_date: "2026-05-28",
        amount: 1000,
        purchases: { purchase_items: [{ purchase_date: "2026-05-20" }] }
      }
    ],
    mayRange,
    [{ label: "2026-05", amount: 1000 }]
  );
  assert.equal(metrics.dueFromEarlierPurchases, 0);
  assert.equal(metrics.monthly[0].dueFromEarlierPurchases, 0);
});
