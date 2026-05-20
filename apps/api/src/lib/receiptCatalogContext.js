/**
 * Contexto compacto do catálogo para o prompt de leitura de notas (limite de tokens).
 */

export function buildReceiptCatalogContext(products = [], categories = [], opts = {}) {
  const maxProducts = opts.maxProducts ?? 150;
  const maxNameLen = opts.maxNameLen ?? 80;
  const maxCategories = opts.maxCategories ?? 80;

  const categoryNames = (categories || [])
    .map((c) => String(c?.name ?? c).trim())
    .filter(Boolean)
    .slice(0, maxCategories);

  const catalogProducts = (products || [])
    .filter((p) => p?.is_active !== false)
    .slice(0, maxProducts)
    .map((p) => ({
      name: String(p.name || "").trim().slice(0, maxNameLen),
      category: String(p.category || "").trim().slice(0, 48) || null,
      unit: String(p.standard_unit || "").trim().slice(0, 16) || null,
      type: p.type === "venda" ? "venda" : "insumo"
    }))
    .filter((p) => p.name);

  return { catalogProducts, categoryNames };
}
