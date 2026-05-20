import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBrDecimal,
  normalizeReceiptUnit,
  reconcileLineItem,
  normalizeRawAiItem
} from "../src/lib/receiptParseUtils.js";

test("parseBrDecimal: formato brasileiro", () => {
  assert.equal(parseBrDecimal("1.930,28"), 1930.28);
  assert.equal(parseBrDecimal("10,52"), 10.52);
  assert.equal(parseBrDecimal("R$ 420,59"), 420.59);
  assert.equal(parseBrDecimal(169.9), 169.9);
});

test("parseBrDecimal: formato US", () => {
  assert.equal(parseBrDecimal("169.90"), 169.9);
});

test("normalizeReceiptUnit: sinónimos", () => {
  assert.equal(normalizeReceiptUnit("CAIXA", ["kg", "cx", "un"]), "cx");
  assert.equal(normalizeReceiptUnit("FD", ["fardo", "un"]), "fardo");
  assert.equal(normalizeReceiptUnit("PCT", ["pct", "un"]), "pct");
  assert.equal(normalizeReceiptUnit("SC", ["saco", "kg"]), "saco");
});

test("reconcileLineItem: calcula total ausente", () => {
  const r = reconcileLineItem({ quantity: 6, unitPrice: 169.9 });
  assert.equal(r.lineTotal, 1019.4);
  assert.equal(r.warnings.length, 0);
});

test("reconcileLineItem: calcula preço ausente", () => {
  const r = reconcileLineItem({ quantity: 10, lineTotal: 420.59 });
  assert.ok(Math.abs(r.unitPrice - 42.059) < 0.01);
});

test("reconcileLineItem: aviso quando os três discordam", () => {
  const r = reconcileLineItem({ quantity: 10, unitPrice: 5, lineTotal: 100 });
  assert.ok(r.warnings.some((w) => w.includes("não confere")));
});

test("normalizeRawAiItem: aplica reconciliação e unidade", () => {
  const row = normalizeRawAiItem(
    {
      productName: "Queijo Mussarela",
      quantity: "55,990",
      unitUsed: "KG",
      unitPrice: "34,50",
      lineTotal: "1930,28"
    },
    ["kg", "un"]
  );
  assert.equal(row.unitUsed, "kg");
  assert.equal(row.quantity, 55.99);
  assert.equal(row.unitPrice, 34.5);
  assert.equal(row.lineTotal, 1930.28);
});
