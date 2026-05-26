/**
 * Mensagens de erro legíveis para o fluxo de registo de compra (confirmar / IA).
 */
export function purchaseApiErrorMessage(err) {
  const st = err?.response?.status;
  const data = err?.response?.data;
  const raw =
    typeof data === "string"
      ? data
      : typeof data?.message === "string"
        ? data.message
        : "";

  if (st === 413 || /too large|entity too large|request entity/i.test(raw) || /too large/i.test(err?.message || "")) {
    return "A foto ou PDF da nota é grande demais para o servidor. Tire outra foto (menos zoom), envie menos ficheiros ou aguarde; o suporte pode aumentar o limite.";
  }

  if (st === 400 && raw.trim()) {
    if (/unique_invoice|duplicate|já existe.*nota/i.test(raw)) {
      return "Já existe uma compra com este número de nota nesta loja. Use outro número ou edite o lançamento anterior.";
    }
    if (/dados dos itens inválidos|fieldErrors/i.test(raw) || data?.details) {
      const flat = flattenZodDetails(data);
      if (flat.length) return `Revise os itens: ${flat.slice(0, 3).join("; ")}`;
    }
    if (/data da compra inválida/i.test(raw)) {
      return "Data da compra inválida. Volte ao passo 1 e escolha uma data válida.";
    }
    if (/arquivo da nota|ficheiro|nota fiscal é obrigatório/i.test(raw)) {
      return "Anexe pelo menos um ficheiro da nota fiscal (JPG, PNG ou PDF).";
    }
    if (/tipo de arquivo não permitido/i.test(raw)) {
      return "Formato de ficheiro não permitido. Use JPG, PNG ou PDF.";
    }
    if (/loja não encontrada|escopo/i.test(raw)) {
      return "A sua conta não está ligada a uma loja. Peça ao administrador para associar o gerente à loja.";
    }
    return raw.trim();
  }

  if (st === 401 || st === 403) {
    return "Sessão expirada ou sem permissão. Saia e entre de novo no painel.";
  }

  if (st === 502 || st === 503 || st === 504) {
    return "O servidor demorou a responder (sobrecarga ou manutenção). Espere um minuto e tente de novo.";
  }

  if (st === 500) {
    return raw.trim()
      ? `Erro no servidor: ${raw.trim()}`
      : "Erro interno ao registar a compra. Tente de novo; se persistir, contacte o suporte.";
  }

  if (err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "")) {
    return "O envio demorou demais (ligação lenta ou ficheiros pesados). Use Wi‑Fi, reduza o tamanho das fotos e tente outra vez.";
  }

  if (!err?.response) {
    return "Sem ligação ao servidor. Verifique a internet e tente de novo.";
  }

  if (raw.trim() && !raw.includes("<!DOCTYPE")) {
    return raw.trim();
  }

  if (st) {
    return `Não foi possível registar a compra (erro ${st}). Tente de novo ou contacte o suporte.`;
  }

  return "Não foi possível registar a compra. Tente novamente.";
}

function flattenZodDetails(data) {
  const fe = data?.details?.fieldErrors || data?.formErrors?.fieldErrors;
  if (!fe || typeof fe !== "object") return [];
  return Object.entries(fe).flatMap(([key, msgs]) => {
    const list = Array.isArray(msgs) ? msgs : [msgs];
    return list.filter(Boolean).map((m) => `${key}: ${m}`);
  });
}
