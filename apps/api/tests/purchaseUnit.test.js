import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePurchaseUnitUsed,
  resolveReceiptItemUnitUsed
} from "../src/lib/measurementUnits.js";

const UNITS = ["kg", "un", "cx"];

test("resolvePurchaseUnitUsed: preserva kg escolhido quando catálogo tem un genérico (mussarela)", () => {
  assert.equal(
    resolvePurchaseUnitUsed({ draftUnit: "kg", catalogUnit: "un", allowedUnits: UNITS }),
    "kg"
  );
});

test("resolvePurchaseUnitUsed: aplica kg do catálogo para mussarela cadastrada corretamente", () => {
  assert.equal(
    resolvePurchaseUnitUsed({ draftUnit: "un", catalogUnit: "kg", allowedUnits: UNITS }),
    "kg"
  );
});

test("resolvePurchaseUnitUsed: fallback kg sem unidade definida", () => {
  assert.equal(resolvePurchaseUnitUsed({ draftUnit: "", catalogUnit: "", allowedUnits: UNITS }), "kg");
});

test("resolveReceiptItemUnitUsed: NF em KG prevalece sobre catálogo un", () => {
  assert.equal(
    resolveReceiptItemUnitUsed({ noteUnit: "KG", catalogUnit: "un", allowedUnits: UNITS }),
    "kg"
  );
});

test("resolveReceiptItemUnitUsed: catálogo kg quando nota não traz unidade", () => {
  assert.equal(
    resolveReceiptItemUnitUsed({ noteUnit: null, catalogUnit: "kg", allowedUnits: UNITS }),
    "kg"
  );
});

test("resolveReceiptItemUnitUsed: nota cx prevalece sobre catálogo un", () => {
  assert.equal(
    resolveReceiptItemUnitUsed({ noteUnit: "CX", catalogUnit: "un", allowedUnits: UNITS }),
    "cx"
  );
});
