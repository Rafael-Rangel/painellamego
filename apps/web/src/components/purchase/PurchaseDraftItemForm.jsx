import { FaPlus } from "react-icons/fa";
import SingleSelectInput from "../ui/SingleSelectInput";
import SingleSelectSearch from "../ui/SingleSelectSearch";
import RequiredLabel, { FieldValidationMessage } from "../ui/RequiredLabel";
import UnitSelect from "../ui/UnitSelect";
import { catalogUserMessage } from "../../lib/catalogFeedback";

function LineTypePicker({ name, value, onChange }) {
  return (
    <div className="purchase-line-type-options purchase-line-type-options--segmented" role="radiogroup" aria-label="Insumo ou venda">
      <label className="purchase-line-type-option">
        <input type="radio" name={name} checked={value === "insumo"} onChange={() => onChange("insumo")} />
        <span>Insumo</span>
      </label>
      <label className="purchase-line-type-option">
        <input type="radio" name={name} checked={value === "venda"} onChange={() => onChange("venda")} />
        <span>Venda</span>
      </label>
    </div>
  );
}

export default function PurchaseDraftItemForm({
  draftItem,
  setDraftItem,
  categoryOptions,
  products,
  unitOptions,
  pickDraftProduct,
  createProduct,
  productCreating,
  onAdd,
  onNotify,
  editing = false,
  submitLabel = "Adicionar",
  onCancel,
  showFieldValidation = false,
  fieldErrors = {},
  listError = "",
  onFieldBlur
}) {
  const bonusOnly = Boolean(draftItem.isBonificationOnly);
  const show = (key) => showFieldValidation && fieldErrors[key];

  return (
    <div className={`wizard-item-form ${editing ? "wizard-item-form--editing" : ""}`}>
      {editing ? (
        <p className="wizard-item-form__editing-banner" role="status">
          Modo edição: altere os campos e toque em «Guardar alteração», ou cancele.
        </p>
      ) : null}
      <section className="wizard-item-form__section wizard-item-form__section--identity">
        <SingleSelectInput
          label="Categoria"
          required
          placeholder="Buscar ou criar…"
          options={categoryOptions}
          value={draftItem.category}
          onChange={(next) => setDraftItem((d) => ({ ...d, category: next }))}
          createEntityLabel="categoria"
          catalogField="category"
          onNotify={onNotify}
          showValidationError={show("category")}
          validationMessage="Informe a categoria do item."
          onFieldBlur={() => onFieldBlur?.("category")}
        />
        <SingleSelectSearch
          label="Produto"
          required
          placeholder="Buscar ou adicionar…"
          options={products.map((product) => ({ value: product.id, label: product.name }))}
          value={draftItem.productId}
          onChange={(id) => pickDraftProduct(id)}
          allowCreate
          createEntityLabel="produto"
          catalogField="product"
          createBusy={productCreating}
          onNotify={onNotify}
          showValidationError={show("product")}
          validationMessage="Selecione um produto da lista ou crie um novo."
          onFieldBlur={() => onFieldBlur?.("product")}
          onCreateOption={async (q) => {
            const cat = String(draftItem.category || "").trim();
            if (cat.length < 2) {
              const msg = catalogUserMessage("category", { reason: "missing_category" });
              onNotify?.(msg, "warning");
              return { ok: false, message: msg };
            }
            const data = await createProduct(q, draftItem.lineType, cat);
            if (!data || data.ok === false) return data || { ok: false, message: catalogUserMessage("product", { reason: "create_failed", value: q }) };
            pickDraftProduct(data.id);
            return data;
          }}
        />
        <div className="wizard-item-form__type">
          <span className="wizard-item-form__type-label">
            Tipo da linha <span className="field-required" aria-hidden="true">*</span>
          </span>
          <LineTypePicker
            name="draft-line-type"
            value={draftItem.lineType === "venda" ? "venda" : "insumo"}
            onChange={(lineType) => setDraftItem((d) => ({ ...d, lineType }))}
          />
        </div>
        <label className="purchase-bonus-toggle">
          <input
            type="checkbox"
            checked={bonusOnly}
            onChange={(e) =>
              setDraftItem((d) => ({
                ...d,
                isBonificationOnly: e.target.checked,
                unitPrice: e.target.checked ? "0" : d.unitPrice
              }))
            }
          />
          <span>Linha só bonificação (sem cobrança)</span>
        </label>
      </section>

      <section className="wizard-item-form__section wizard-item-form__metrics" aria-label="Quantidade, unidade e valor">
        <div className="wizard-item-form__metrics-row">
          <div className={`field field-wizard wizard-item-form__metric${show("quantity") ? " field--invalid" : ""}`}>
            <RequiredLabel htmlFor="draft-qty" required>
              Quantidade
            </RequiredLabel>
            <input
              id="draft-qty"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={draftItem.quantity}
              onChange={(e) => setDraftItem((d) => ({ ...d, quantity: e.target.value }))}
              onBlur={() => onFieldBlur?.("quantity")}
              aria-invalid={show("quantity") ? "true" : undefined}
            />
            {show("quantity") ? (
              <FieldValidationMessage>
                {bonusOnly ? "Informe a quantidade bonificada." : "Informe a quantidade comprada."}
              </FieldValidationMessage>
            ) : null}
          </div>
          <div className="field field-wizard wizard-item-form__metric">
            <label htmlFor="draft-unit">Unidade</label>
            <UnitSelect
              id="draft-unit"
              value={draftItem.unitUsed}
              units={unitOptions}
              products={products}
              onChange={(e) => setDraftItem((d) => ({ ...d, unitUsed: e.target.value }))}
            />
          </div>
        </div>
        {!bonusOnly ? (
          <div className={`field field-wizard wizard-item-form__metric wizard-item-form__metric--full${show("unitPrice") ? " field--invalid" : ""}`}>
            <RequiredLabel htmlFor="draft-price" required>
              Valor unitário (R$)
            </RequiredLabel>
            <input
              id="draft-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draftItem.unitPrice}
              onChange={(e) => setDraftItem((d) => ({ ...d, unitPrice: e.target.value }))}
              onBlur={() => onFieldBlur?.("unitPrice")}
              aria-invalid={show("unitPrice") ? "true" : undefined}
            />
            {show("unitPrice") ? <FieldValidationMessage>Informe o valor unitário.</FieldValidationMessage> : null}
          </div>
        ) : (
          <div className={`field field-wizard wizard-item-form__metric wizard-item-form__metric--full${show("unitPrice") ? " field--invalid" : ""}`}>
            <RequiredLabel htmlFor="draft-bonus-val" required>
              Valor ref. bonificação (R$)
            </RequiredLabel>
            <input
              id="draft-bonus-val"
              type="number"
              min="0"
              step="0.01"
              value={draftItem.bonusUnitValue}
              onChange={(e) => setDraftItem((d) => ({ ...d, bonusUnitValue: e.target.value }))}
              onBlur={() => onFieldBlur?.("unitPrice")}
              aria-invalid={show("unitPrice") ? "true" : undefined}
            />
            {show("unitPrice") ? <FieldValidationMessage>Informe o valor de referência.</FieldValidationMessage> : null}
          </div>
        )}
      </section>

      {!bonusOnly ? (
        <section className="wizard-item-form__section wizard-item-form__bonus-row" aria-label="Bonificação opcional">
          <div className="field field-wizard wizard-item-form__bonus-field">
            <label>Qtd. bonificada (opcional)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={draftItem.bonusQuantity}
              onChange={(e) => setDraftItem((d) => ({ ...d, bonusQuantity: e.target.value }))}
            />
          </div>
          <div className="field field-wizard wizard-item-form__bonus-field">
            <label>Valor ref. un. bonificação (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draftItem.bonusUnitValue}
              onChange={(e) => setDraftItem((d) => ({ ...d, bonusUnitValue: e.target.value }))}
            />
          </div>
        </section>
      ) : null}

      <div className="wizard-item-form__actions">
        {listError ? <FieldValidationMessage>{listError}</FieldValidationMessage> : null}
        {editing && onCancel ? (
          <button className="btn btn-ghost wizard-item-form__add" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button className="btn btn-secondary wizard-item-form__add wizard-item-form__add--icon" type="button" onClick={onAdd}>
          <FaPlus aria-hidden className="wizard-item-form__add-icon" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export { LineTypePicker };
