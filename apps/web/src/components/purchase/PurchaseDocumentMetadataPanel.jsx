import {
  EMPTY_DOCUMENT_METADATA,
  mapApiMetadataToForm,
  metadataToNotesText
} from "../../lib/aiFieldConfidence";

export { EMPTY_DOCUMENT_METADATA, mapApiMetadataToForm, metadataToNotesText };

export default function PurchaseDocumentMetadataPanel({
  metadata,
  onChange,
  onNotesSync,
  aiClass = () => ""
}) {
  const update = (key, value) => {
    const next = { ...metadata, [key]: value };
    onChange?.(next);
    onNotesSync?.(metadataToNotesText(next));
  };

  const fields = [
    { key: "accessKey", label: "Chave de acesso", type: "text", placeholder: "44 dígitos" },
    { key: "series", label: "Série", type: "text" },
    { key: "issueDate", label: "Data de emissão", type: "date" },
    { key: "exitDate", label: "Data de saída", type: "date" },
    { key: "orderNumber", label: "Nº pedido", type: "text" },
    { key: "paymentTerms", label: "Condição de pagamento", type: "text" },
    { key: "paymentDeadlineDays", label: "Prazo (dias)", type: "number", min: 0 },
    { key: "salesRep", label: "Representante / vendedor", type: "text" },
    { key: "carrierName", label: "Transportadora", type: "text" }
  ];

  return (
    <section className="purchase-doc-metadata card" aria-label="Dados fiscais da nota">
      <h4 className="purchase-doc-metadata__title">Dados fiscais e complementares</h4>
      <p className="field-helper purchase-doc-metadata__lead">
        Preenchidos automaticamente pela IA. Revise e ajuste se necessário.
      </p>
      <div className="purchase-doc-metadata__grid">
        {fields.map(({ key, label, type, placeholder, min }) => (
          <div key={key} className={`field field-wizard ${aiClass(`metadata.${key}`)}`}>
            <label htmlFor={`doc-meta-${key}`}>{label}</label>
            <input
              id={`doc-meta-${key}`}
              type={type}
              min={min}
              placeholder={placeholder}
              value={metadata[key] ?? ""}
              onChange={(e) => update(key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className={`field field-wizard ${aiClass("metadata.complementaryInfo")}`}>
        <label htmlFor="doc-meta-complementary">Informações complementares (texto livre)</label>
        <textarea
          id="doc-meta-complementary"
          rows={3}
          value={metadata.complementaryInfo ?? ""}
          placeholder="Observações do fornecedor, romaneio, cobrança..."
          onChange={(e) => {
            const next = { ...metadata, complementaryInfo: e.target.value };
            onChange?.(next);
            onNotesSync?.(metadataToNotesText(next));
          }}
        />
      </div>
    </section>
  );
}
