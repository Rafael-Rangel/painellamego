/**
 * Mensagens e logs padronizados para campos de catálogo (fornecedor, produto, categoria, etc.).
 */

export const CATALOG_FIELDS = {
  supplier: {
    key: "supplier",
    label: "Fornecedor",
    entity: "fornecedor",
    gender: "m"
  },
  product: {
    key: "product",
    label: "Produto",
    entity: "produto",
    gender: "m"
  },
  category: {
    key: "category",
    label: "Categoria",
    entity: "categoria",
    gender: "f"
  },
  store: {
    key: "store",
    label: "Loja",
    entity: "loja",
    gender: "f"
  },
  unit: {
    key: "unit",
    label: "Unidade",
    entity: "unidade",
    gender: "f"
  }
};

function quote(value) {
  const s = String(value || "").trim();
  return s ? `“${s}”` : "";
}

/** Log interno (sempre com campo e valor digitado). */
export function logCatalog(event, fieldKey, details = {}) {
  const field = CATALOG_FIELDS[fieldKey] || { key: fieldKey, label: fieldKey };
  const payload = { field: field.label, fieldKey, ...details };
  if (event === "error") {
    console.warn(`[catalog:${fieldKey}]`, event, payload);
  } else {
    console.info(`[catalog:${fieldKey}]`, event, payload);
  }
}

export function logCatalogError(fieldKey, value, err, action = "create") {
  logCatalog("error", fieldKey, {
    action,
    value: String(value || "").trim(),
    status: err?.response?.status,
    apiMessage: err?.response?.data?.message,
    details: err?.response?.data
  });
}

function apiMessageFromResponse(err) {
  const d = err?.response?.data;
  if (typeof d?.message === "string" && d.message.trim()) return d.message.trim();
  const nameErr = d?.formErrors?.fieldErrors?.name;
  if (Array.isArray(nameErr) && nameErr[0]) return String(nameErr[0]);
  if (typeof nameErr === "string") return nameErr;
  return null;
}

/** Mensagem amigável para o utilizador. */
export function catalogUserMessage(fieldKey, { reason, value = "", apiMessage = null, hint = null } = {}) {
  const f = CATALOG_FIELDS[fieldKey] || { entity: fieldKey, label: fieldKey, gender: "m" };
  const q = quote(value);
  const art = f.gender === "f" ? "A" : "O";

  switch (reason) {
    case "too_short":
      return `Digite pelo menos 2 caracteres para ${f.entity === "categoria" ? "a" : "o"} ${f.entity}.`;
    case "not_found":
      return `${art} ${f.entity} ${q} não existe na lista. Verifique o nome digitado ou use o botão «+ Adicionar ${f.entity}».`;
    case "not_selected":
      return `Seleccione ${f.entity === "categoria" ? "uma" : "um"} ${f.entity} da lista ou adicione um novo.`;
    case "missing_category":
      return "Informe a categoria antes de adicionar o produto, ou use «+ Usar categoria» na lista.";
    case "no_store":
      return "Não há loja vinculada. Peça ao administrador para configurar a loja antes de cadastrar fornecedor.";
    case "create_failed":
      return apiMessage
        ? `${art} ${f.entity} ${q} não foi adicionado: ${apiMessage}`
        : `Não foi possível adicionar ${f.entity === "categoria" ? "a" : "o"} ${f.entity} ${q}. Tente de novo ou escolha um item da lista.`;
    case "api":
      return apiMessage || `Não foi possível guardar ${f.entity === "categoria" ? "a" : "o"} ${f.entity} ${q}.`;
    default:
      return hint || apiMessage || `Ocorreu um problema ao processar ${f.entity === "categoria" ? "a" : "o"} ${f.entity}.`;
  }
}

export function catalogMessageFromApiError(fieldKey, value, err, action = "create") {
  logCatalogError(fieldKey, value, err, action);
  const apiMessage = apiMessageFromResponse(err);
  return catalogUserMessage(fieldKey, { reason: "api", value, apiMessage });
}

export function catalogNotFoundOnBlur(fieldKey, value) {
  logCatalog("not_found_on_blur", fieldKey, { value: String(value || "").trim() });
  return catalogUserMessage(fieldKey, { reason: "not_found", value });
}
