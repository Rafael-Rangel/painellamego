/** Espelho de apps/api/src/lib/receiptAiUserMessages.js — mensagens seguras para UI. */

export const RECEIPT_AI_USER_DEFAULT =
  "Não foi possível analisar a nota agora. Tente novamente em alguns minutos.";

export const RECEIPT_AI_USER_TIMEOUT =
  "A análise demorou demais. Verifique a ligação e toque em «Analisar com IA» novamente.";

export const RECEIPT_AI_USER_PAYLOAD =
  "Não foi possível enviar as fotos. Use imagens mais leves ou envie menos páginas de cada vez.";

export const RECEIPT_AI_USER_UNREADABLE =
  "Não conseguimos ler esta nota. Confira se as fotos estão nítidas e tente analisar de novo.";

export function receiptAiUserFacingMessage(err) {
  const raw =
    typeof err === "string"
      ? err
      : String(err?.message || err?.response?.data?.message || "").trim();
  const code = err?.code || err?.response?.data?.code;
  const status = err?.status ?? err?.response?.status;

  if (code === "ECONNABORTED" || status === 504 || status === 502 || status === 503) {
    return RECEIPT_AI_USER_TIMEOUT;
  }
  if (status === 413) return RECEIPT_AI_USER_PAYLOAD;

  const lower = raw.toLowerCase();
  if (
    /quota|billing|insufficient|openai|openrouter|gemini|gpt-|api.key|receipt_ai_keys|provider/i.test(
      lower
    )
  ) {
    return RECEIPT_AI_USER_DEFAULT;
  }
  if (
    lower.includes("tempo esgotado") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("demorou demais")
  ) {
    return RECEIPT_AI_USER_TIMEOUT;
  }
  if (
    lower.includes("413") ||
    lower.includes("muito grande") ||
    lower.includes("file too large") ||
    lower.includes("payload")
  ) {
    return RECEIPT_AI_USER_PAYLOAD;
  }
  if (
    lower.includes("formato inválido") ||
    lower.includes("resposta vazia") ||
    lower.includes("não devolveu dados legíveis") ||
    lower.includes("nao devolveu dados legiveis") ||
    lower.includes("não conseguimos ler") ||
    lower.includes("nao conseguimos ler")
  ) {
    return RECEIPT_AI_USER_UNREADABLE;
  }

  return RECEIPT_AI_USER_DEFAULT;
}
