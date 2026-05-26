import { useState } from "react";
import { api, withAuth } from "../../api";
import CompactTable from "../ui/CompactTable";
import { formatCurrency } from "../../lib/formatters";

function parsePriceInput(raw) {
  const s = String(raw || "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export default function ProductSalePricePanel({ token, products, onRefresh, onToast }) {
  const [editingId, setEditingId] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(productId) {
    const salePrice = parsePriceInput(draftValue);
    if (Number.isNaN(salePrice)) {
      onToast?.("Preço inválido.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/catalog/products/${productId}/sale-price`, { salePrice }, withAuth(token));
      onToast?.("Preço de venda atualizado.");
      setEditingId(null);
      await onRefresh?.();
    } catch (err) {
      onToast?.(err?.response?.data?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CompactTable
      scrollHorizontal
      mobileCompact
      columns={[
        { id: "name", label: "Produto" },
        { id: "category", label: "Categoria" },
        {
          id: "sale_price",
          label: "Preço de venda",
          render: (p) => {
            if (editingId === p.id) {
              return (
                <div className="sale-price-edit-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="sale-price-input"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder="0,00"
                  />
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void save(p.id)}>
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              );
            }
            return p.sale_price != null ? formatCurrency(p.sale_price) : "—";
          }
        },
        {
          id: "actions",
          label: "",
          render: (p) =>
            editingId === p.id ? null : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setEditingId(p.id);
                  setDraftValue(p.sale_price != null ? String(p.sale_price).replace(".", ",") : "");
                }}
              >
                Editar
              </button>
            )
        }
      ]}
      rows={products}
      keyField="id"
      emptyMessage="Nenhum produto."
    />
  );
}
