import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDocumentMetadata,
  buildInvoiceNotesFromMetadata,
  normalizeFieldConfidenceMap
} from "../src/lib/receiptParseUtils.js";

test("buildInvoiceNotesFromMetadata: metadados DANFE Beirão da Serra", () => {
  const metadata = normalizeDocumentMetadata({
    orderNumber: "49473",
    paymentTerms: "30 DIAS",
    salesRep: "REPRESENTANTE XYZ",
    carrierName: "TRANSPORTADORA ABC"
  });
  const notes = buildInvoiceNotesFromMetadata(
    metadata,
    "Valor FCP R$ 4,19. PEDIDO 49473 conforme informações complementares."
  );
  assert.ok(notes.includes("Pedido: 49473"));
  assert.ok(notes.includes("Condição de pagamento: 30 DIAS"));
  assert.ok(notes.includes("Valor FCP"));
});

test("buildInvoiceNotesFromMetadata: vazio quando sem dados", () => {
  assert.equal(buildInvoiceNotesFromMetadata({}, ""), "");
  assert.equal(buildInvoiceNotesFromMetadata(null, null), "");
});

test("normalizeFieldConfidenceMap: chaves de cabeçalho e metadados", () => {
  const map = normalizeFieldConfidenceMap({
    invoiceNumber: "high",
    "metadata.orderNumber": "medium",
    "metadata.accessKey": "low"
  });
  assert.equal(map.invoiceNumber, "high");
  assert.equal(map["metadata.orderNumber"], "medium");
  assert.equal(map["metadata.accessKey"], "low");
});
