/** Categoria usada para produtos criados rapidamente pelo gerente (catálogo global). */
export const QUICK_PRODUCT_CATEGORY = "Outros";

/**
 * Chave estável para deduplicar produtos (acentos removidos, minúsculas, espaços colapsados).
 * Usar a mesma função na IA e no endpoint /catalog/products/quick.
 */
export function normalizeProductNameKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
