import { useCallback, useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { api, withAuth } from "../../api";
import { useCatalogEditFlash } from "../../hooks/useCatalogEditFlash";
import CompactTable from "../ui/CompactTable";
import SingleSelectSearch from "../ui/SingleSelectSearch";

const EMPTY_FORM = { name: "", storeId: "" };

/**
 * CRUD de fornecedores (gerente: loja automática; admin: pode escolher loja).
 */
export default function SupplierCrudPanel({
  token,
  suppliers = [],
  stores = [],
  showStorePicker = false,
  loading = false,
  onRefresh,
  onToast
}) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const { formClass: editFormClass, triggerEditFlash } = useCatalogEditFlash(Boolean(editingId));

  const storeOptions = stores.map((s) => ({
    value: s.id,
    label: s.store_number != null ? `Loja ${s.store_number}  ·  ${s.name}` : s.name
  }));

  const storeNameById = useCallback(
    (id) => {
      const s = stores.find((x) => x.id === id);
      if (!s) return "n/d";
      return s.store_number != null ? `Loja ${s.store_number}  ·  ${s.name}` : s.name;
    },
    [stores]
  );

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      storeId: row.store_id || ""
    });
    triggerEditFlash();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      onToast?.("O nome do fornecedor deve ter pelo menos 2 caracteres.");
      return;
    }
    if (showStorePicker && !editingId && !form.storeId) {
      onToast?.("Seleccione a loja do fornecedor.");
      return;
    }

    setSaving(true);
    try {
      const body = { name };
      if (showStorePicker && form.storeId) body.storeId = form.storeId;

      if (editingId) {
        await api.put(`/catalog/suppliers/${editingId}`, body, withAuth(token));
        onToast?.("Fornecedor actualizado.");
      } else {
        await api.post("/catalog/suppliers", body, withAuth(token));
        onToast?.("Fornecedor criado.");
      }
      resetForm();
      await onRefresh?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "Não foi possível guardar o fornecedor.";
      onToast?.(typeof msg === "string" ? msg : "Não foi possível guardar o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSupplier(row) {
    if (!window.confirm(`Remover o fornecedor “${row.name}”?`)) return;
    setSaving(true);
    try {
      await api.delete(`/catalog/suppliers/${row.id}`, withAuth(token));
      onToast?.("Fornecedor removido.");
      if (editingId === row.id) resetForm();
      await onRefresh?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "Não foi possível remover o fornecedor.";
      onToast?.(typeof msg === "string" ? msg : "Não foi possível remover o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="supplier-crud">
      <form
        className={`admin-catalog-product-form supplier-crud-form ${editFormClass}`.trim()}
        onSubmit={(ev) => void handleSubmit(ev)}
      >
        <div className="admin-catalog-product-form__row">
          <div className="field admin-catalog-product-form__field">
            <label>{editingId ? "Editar fornecedor" : "Novo fornecedor"}</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Distribuidora Centro Sul"
              required
              minLength={2}
            />
          </div>
          {showStorePicker ? (
            <div className="admin-catalog-product-form__cell">
              <SingleSelectSearch
                label="Loja"
                placeholder="Seleccione a loja…"
                options={storeOptions}
                value={form.storeId}
                onChange={(next) => setForm((f) => ({ ...f, storeId: next }))}
              />
            </div>
          ) : null}
          <div className="admin-catalog-product-form__actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "A guardar…" : editingId ? "Salvar" : "Adicionar"}
            </button>
            {editingId ? (
              <button className="btn btn-ghost" type="button" disabled={saving} onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <CompactTable
        columns={[
          { id: "name", label: "Nome", render: (r) => <strong>{r.name}</strong> },
          ...(showStorePicker
            ? [
                {
                  id: "store",
                  label: "Loja",
                  render: (r) => (r.store_id ? storeNameById(r.store_id) : "n/d")
                }
              ]
            : []),
          {
            id: "actions",
            label: "Acções",
            render: (r) => (
              <div className="catalog-row-actions">
                <button type="button" className="btn btn-ghost btn-icon" title="Editar" disabled={saving} onClick={() => startEdit(r)}>
                  <FaEdit />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" title="Remover" disabled={saving} onClick={() => void removeSupplier(r)}>
                  <FaTrash />
                </button>
              </div>
            )
          }
        ]}
        rows={suppliers}
        keyField="id"
        loading={loading}
        emptyMessage="Nenhum fornecedor cadastrado."
      />
    </div>
  );
}

