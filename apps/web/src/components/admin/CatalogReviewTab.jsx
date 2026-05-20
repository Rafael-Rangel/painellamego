import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCheck, FaEdit, FaSearch, FaSync, FaTrash } from "react-icons/fa";
import { MdAutoAwesome } from "react-icons/md";
import { api, withAuth } from "../../api";
import { useCatalogEditFlash } from "../../hooks/useCatalogEditFlash";
import CompactTable from "../ui/CompactTable";
import DataCard from "../ui/DataCard";
import SingleSelectInput from "../ui/SingleSelectInput";
import SingleSelectSearch from "../ui/SingleSelectSearch";

const EMPTY_FORM = { name: "", category: "", type: "insumo", standardUnit: "un" };

function originBadge(createdBy) {
  if (createdBy === "ai_auto") return <span className="badge badge-info">IA</span>;
  if (createdBy === "manager") return <span className="badge badge-warning">Gerente</span>;
  return <span className="badge badge-success">Rede</span>;
}

export default function CatalogReviewTab({ token, catalogProducts = [], categoryOptions = [], unitOptions = [], onToast, onDataChanged }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const { flashFormClass, triggerEditFlash } = useCatalogEditFlash();
  const prevEditingIdRef = useRef(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [mergeCanonicalId, setMergeCanonicalId] = useState("");
  const [mergeSelectedIds, setMergeSelectedIds] = useState(() => new Set());
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeNewName, setMergeNewName] = useState("");
  const [mergeNewCategory, setMergeNewCategory] = useState("");

  const catalogProductOptions = useMemo(
    () =>
      (catalogProducts || []).map((p) => ({
        value: p.id,
        label: `${p.name}${p.category ? ` · ${p.category}` : ""}`
      })),
    [catalogProducts]
  );

  const loadPending = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get("/catalog/products/pending-catalog-review", withAuth(token));
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      onToast?.("Não foi possível carregar a fila de revisão.");
    } finally {
      setLoading(false);
    }
  }, [token, onToast]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (editingId && editingId !== prevEditingIdRef.current) {
      triggerEditFlash();
    }
    prevEditingIdRef.current = editingId;
  }, [editingId, triggerEditFlash]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.name, r.category, r.type, r.standard_unit, r.created_by].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter]);

  const pendingCount = rows.filter((r) => r.needs_catalog_review).length;

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      category: row.category || "",
      type: row.type === "venda" ? "venda" : "insumo",
      standardUnit: row.standard_unit || "un"
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function toggleMergeSelect(productId) {
    setMergeSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function selectAllVisible() {
    setMergeSelectedIds(new Set(filteredRows.map((r) => r.id)));
  }

  function useFirstSelectedAsCanonical() {
    const ids = [...mergeSelectedIds];
    if (!ids.length) {
      onToast?.("Seleccione pelo menos uma linha na tabela.");
      return;
    }
    setMergeCanonicalId(ids[0]);
    onToast?.("Produto canónico definido a partir da selecção.");
  }

  async function saveProduct({ approve }) {
    if (!editingId) return;
    if (!form.name.trim() || !form.category.trim()) {
      onToast?.("Nome e categoria são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await api.put(
        `/catalog/products/${editingId}`,
        {
          name: form.name.trim(),
          category: form.category.trim(),
          type: form.type,
          standardUnit: form.standardUnit || "un",
          needsCatalogReview: !approve
        },
        withAuth(token)
      );
      onToast?.(approve ? "Produto guardado e aprovado." : "Alterações guardadas (ainda pendente).");
      cancelEdit();
      await loadPending();
      await onDataChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao guardar produto.";
      onToast?.(typeof msg === "string" ? msg : "Erro ao guardar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function quickApprove(row) {
    setSaving(true);
    try {
      await api.put(
        `/catalog/products/${row.id}`,
        {
          name: row.name,
          category: row.category,
          type: row.type,
          standardUnit: row.standard_unit || "un",
          needsCatalogReview: false
        },
        withAuth(token)
      );
      onToast?.(`“${row.name}” marcado como revisto.`);
      if (editingId === row.id) cancelEdit();
      await loadPending();
      await onDataChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "Erro ao aprovar.";
      onToast?.(typeof msg === "string" ? msg : "Erro ao aprovar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(row) {
    if (!window.confirm(`Remover “${row.name}” do catálogo? Compras antigas podem impedir a remoção.`)) return;
    setSaving(true);
    try {
      await api.delete(`/catalog/products/${row.id}`, withAuth(token));
      onToast?.("Produto removido.");
      if (editingId === row.id) cancelEdit();
      setMergeSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(row.id);
        return n;
      });
      await loadPending();
      await onDataChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "Não foi possível remover (pode estar em uso em compras).";
      onToast?.(typeof msg === "string" ? msg : "Não foi possível remover.");
    } finally {
      setSaving(false);
    }
  }

  async function submitMerge() {
    const mergeIds = [...mergeSelectedIds].filter((id) => id && id !== mergeCanonicalId);
    if (!mergeCanonicalId || mergeIds.length < 1) {
      onToast?.("Escolha o produto canónico e marque pelo menos uma linha duplicada a fundir.");
      return;
    }
    setMergeBusy(true);
    try {
      const body = { canonicalProductId: mergeCanonicalId, mergeProductIds: mergeIds };
      if (mergeNewName.trim().length >= 2) body.newName = mergeNewName.trim();
      if (mergeNewCategory.trim().length >= 2) body.newCategory = mergeNewCategory.trim();
      await api.post("/catalog/products/merge", body, withAuth(token));
      onToast?.(`${mergeIds.length} produto(s) fundido(s) no canónico.`);
      setMergeSelectedIds(new Set());
      setMergeNewName("");
      setMergeNewCategory("");
      await loadPending();
      await onDataChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "Fusão falhou.";
      onToast?.(typeof msg === "string" ? msg : "Fusão falhou.");
    } finally {
      setMergeBusy(false);
    }
  }

  const editingRow = editingId ? rows.find((r) => r.id === editingId) : null;

  return (
    <div className="grid catalog-review-root">
      <section className="span-12">
        <DataCard
          title={
            <span className="catalog-review-title">
              <MdAutoAwesome className="catalog-review-title-icon" aria-hidden />
              Revisão de produtos (IA)
            </span>
          }
          subtitle="Revise nomes, categorias e unidades. Aprove itens correctos, funda duplicados ou remova entradas erradas."
        >
          <div className="catalog-review-toolbar">
            <div className="catalog-review-stats">
              <span className="badge badge-warning">{pendingCount} pendente(s)</span>
              <span className="badge badge-info">{rows.length} na fila</span>
            </div>
            <div className="catalog-review-toolbar-actions">
              <div className="catalog-review-search field" style={{ marginBottom: 0 }}>
                <label className="visually-hidden" htmlFor="catalog-review-filter">
                  Filtrar
                </label>
                <span className="catalog-review-search-icon" aria-hidden>
                  <FaSearch />
                </span>
                <input
                  id="catalog-review-filter"
                  type="search"
                  placeholder="Filtrar por nome, categoria…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void loadPending()}>
                <FaSync style={{ marginRight: "0.35rem" }} aria-hidden />
                Actualizar
              </button>
            </div>
          </div>
        </DataCard>
      </section>

      <section className="span-12">
        <DataCard title="Fundir duplicados" subtitle="O produto canónico fica activo; os seleccionados passam a alias e são desactivados.">
          <div className="catalog-review-merge-grid">
            <SingleSelectSearch
              label="Produto canónico (destino)"
              placeholder="Buscar no catálogo…"
              options={catalogProductOptions}
              value={mergeCanonicalId}
              onChange={setMergeCanonicalId}
            />
            <div className="field">
              <label>Nome final (opcional)</label>
              <input
                value={mergeNewName}
                onChange={(e) => setMergeNewName(e.target.value)}
                placeholder="Sobrescrever nome do canónico"
              />
            </div>
            <SingleSelectInput
              label="Categoria final (opcional)"
              placeholder="Ao fundir…"
              options={categoryOptions}
              value={mergeNewCategory}
              onChange={setMergeNewCategory}
            />
          </div>
          <div className="catalog-review-merge-actions">
            <button type="button" className="btn btn-primary" disabled={mergeBusy || saving} onClick={() => void submitMerge()}>
              {mergeBusy ? "A fundir…" : "Fundir linhas seleccionadas"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={useFirstSelectedAsCanonical}>
              Canónico = 1.º seleccionado
            </button>
            <button type="button" className="btn btn-ghost" onClick={selectAllVisible}>
              Seleccionar visíveis
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMergeSelectedIds(new Set())}>
              Limpar selecção
            </button>
          </div>
        </DataCard>
      </section>

      {editingId ? (
        <section className="span-12">
          <DataCard
            title="Editar produto"
            subtitle={editingRow ? `A editar: ${editingRow.name}` : "Preencha os campos e guarde ou aprove."}
          >
            <form
              className={`admin-catalog-product-form ${flashFormClass}`.trim()}
              onSubmit={(e) => {
                e.preventDefault();
                void saveProduct({ approve: true });
              }}
            >
              <div className="admin-catalog-product-form__row">
                <div className="field admin-catalog-product-form__field">
                  <label>Nome</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="admin-catalog-product-form__cell">
                  <SingleSelectInput
                    label="Categoria"
                    placeholder="Digite ou seleccione…"
                    options={categoryOptions}
                    value={form.category}
                    onChange={(next) => setForm((f) => ({ ...f, category: next }))}
                  />
                </div>
              </div>
              <div className="admin-catalog-product-form__row">
                <div className="field admin-catalog-product-form__field admin-catalog-product-form__field--tipo">
                  <label>Tipo</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="insumo">Insumo</option>
                    <option value="venda">Venda</option>
                  </select>
                </div>
                <div className="admin-catalog-product-form__cell admin-catalog-product-form__cell--unit">
                  <SingleSelectInput
                    label="Unidade padrão"
                    placeholder="Digite ou seleccione…"
                    options={unitOptions}
                    value={form.standardUnit}
                    onChange={(next) => setForm((f) => ({ ...f, standardUnit: next }))}
                  />
                </div>
                <div className="admin-catalog-product-form__actions catalog-review-edit-actions">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    <FaCheck style={{ marginRight: "0.35rem" }} aria-hidden />
                    {saving ? "A guardar…" : "Salvar e aprovar"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => void saveProduct({ approve: false })}
                  >
                    Salvar (manter pendente)
                  </button>
                  <button className="btn btn-ghost" type="button" disabled={saving} onClick={cancelEdit}>
                    Cancelar
                  </button>
                  {editingRow ? (
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteProduct(editingRow)}
                    >
                      <FaTrash style={{ marginRight: "0.35rem" }} aria-hidden />
                      Excluir
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          </DataCard>
        </section>
      ) : null}

      <section className="span-12">
        <DataCard title="Fila de revisão">
          <CompactTable
            columns={[
              {
                id: "sel",
                label: "",
                render: (r) => (
                  <input
                    type="checkbox"
                    checked={mergeSelectedIds.has(r.id)}
                    onChange={() => toggleMergeSelect(r.id)}
                    aria-label={`Seleccionar ${r.name}`}
                  />
                )
              },
              { id: "name", label: "Nome", render: (r) => <strong>{r.name}</strong> },
              { id: "category", label: "Categoria" },
              { id: "type", label: "Tipo", render: (r) => (r.type === "venda" ? "Venda" : "Insumo") },
              { id: "standard_unit", label: "Un." },
              { id: "created_by", label: "Origem", render: (r) => originBadge(r.created_by) },
              {
                id: "flags",
                label: "Estado",
                render: (r) =>
                  r.needs_catalog_review ? (
                    <span className="badge badge-warning">Pendente</span>
                  ) : (
                    <span className="badge badge-success">Só IA/legado</span>
                  )
              },
              {
                id: "actions",
                label: "Acções",
                render: (r) => (
                  <div className="catalog-review-row-actions">
                    <button type="button" className="btn btn-ghost btn-icon" title="Editar" onClick={() => startEdit(r)}>
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="Aprovar sem abrir editor"
                      disabled={saving}
                      onClick={() => void quickApprove(r)}
                    >
                      <FaCheck aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      title="Remover"
                      disabled={saving}
                      onClick={() => void deleteProduct(r)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                )
              }
            ]}
            rows={filteredRows}
            keyField="id"
            loading={loading}
            emptyMessage={
              filter.trim()
                ? "Nenhum resultado para o filtro."
                : "Nenhum produto na fila. Itens criados pela IA ou marcados para revisão aparecem aqui."
            }
          />
        </DataCard>
      </section>
    </div>
  );
}
