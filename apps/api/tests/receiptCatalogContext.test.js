import test from "node:test";
import assert from "node:assert/strict";
import { buildReceiptCatalogContext } from "../src/lib/receiptCatalogContext.js";

test("buildReceiptCatalogContext: compacta produtos e categorias", () => {
  const { catalogProducts, categoryNames } = buildReceiptCatalogContext(
    [
      { name: "Queijo Mussarela", category: "Laticínios", standard_unit: "kg", type: "insumo", is_active: true },
      { name: "Café Capital", category: "Bebidas", standard_unit: "fardo", type: "insumo", is_active: true }
    ],
    [{ name: "Laticínios" }, { name: "Bebidas" }]
  );
  assert.equal(catalogProducts.length, 2);
  assert.equal(catalogProducts[0].unit, "kg");
  assert.equal(catalogProducts[1].type, "insumo");
  assert.deepEqual(categoryNames, ["Laticínios", "Bebidas"]);
});
