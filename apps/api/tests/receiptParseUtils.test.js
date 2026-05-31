import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBrDecimal,
  normalizeReceiptUnit,
  reconcileLineItem,
  normalizeRawAiItem,
  buildDocumentTotalHints,
  cleanReceiptProductDescription
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

test("buildDocumentTotalHints: total da nota maior por outras despesas (DANFE)", () => {
  const hints = buildDocumentTotalHints(
    {
      productsSubtotal: 1755.42,
      documentTotal: 1758.42,
      otherExpensesAmount: 3,
      freightAmount: 0,
      insuranceAmount: 0,
      discountAmount: 0
    },
    [411.1, 1344.32]
  );
  assert.ok(hints.some((h) => h.includes("Total da nota")));
  assert.ok(hints.some((h) => h.includes("outras despesas")));
});

test("buildDocumentTotalHints: sem aviso quando total da nota = soma produtos", () => {
  const hints = buildDocumentTotalHints({ documentTotal: 100, productsSubtotal: 100 }, [60, 40]);
  assert.equal(hints.length, 0);
});

test("buildDocumentTotalHints: ICMS ST no rodapé (BRF)", () => {
  const hints = buildDocumentTotalHints(
    {
      productsSubtotal: 1734.07,
      documentTotal: 1786.06,
      icmsStAmount: 51.99
    },
    [509.97, 736.36, 487.74]
  );
  assert.ok(hints.some((h) => h.includes("ICMS ST")));
});

test("cleanReceiptProductDescription: remove bloco FCP da descrição DANFE", () => {
  const raw =
    "ATUM PORT.MINERVA SOLIDO AZEITE CX 25X120 Valor base calculo FCP R$ 209,40; Valor FCP R$ 4,19(2,00%)";
  assert.equal(cleanReceiptProductDescription(raw), "ATUM PORT.MINERVA SOLIDO AZEITE CX 25X120");
});

test("normalizeRawAiItem: limpa descrição longa de DANFE", () => {
  const row = normalizeRawAiItem(
    {
      productName:
        "GRAO DE BICO DUOLIVAL-VIDRO CX 12X400 Valor base calculo FCP R$ 65,07; Val Aprox Tributos: 51,14 (42,87%)",
      quantity: 1,
      unitUsed: "CX",
      unitPrice: 119.3,
      lineTotal: 119.3
    },
    ["cx", "un"]
  );
  assert.equal(row.productName, "GRAO DE BICO DUOLIVAL-VIDRO CX 12X400");
  assert.equal(row.unitUsed, "cx");
});

test("normalizeReceiptUnit: BAL balde", () => {
  assert.equal(normalizeReceiptUnit("BAL", ["bal", "cx"]), "bal");
});

test("normalizeReceiptUnit: LT e CAIXA", () => {
  assert.equal(normalizeReceiptUnit("LT", ["L", "kg"]), "L");
  assert.equal(normalizeReceiptUnit("CAIXA", ["cx", "un"]), "cx");
  assert.equal(normalizeReceiptUnit("FARDO", ["fardo", "un"]), "fardo");
});

test("receiptUnitConflict: detecta cx vs kg", async () => {
  const { receiptUnitConflict } = await import("../src/lib/receiptParseUtils.js");
  const clash = receiptUnitConflict("cx", "kg", ["cx", "kg"]);
  assert.ok(clash);
  assert.equal(clash.noteUnit, "cx");
  assert.equal(clash.catalogUnit, "kg");
});
