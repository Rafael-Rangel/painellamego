import { config } from "../config.js";

/**
 * Pedido de e-mail de recuperação de senha (GoTrue /auth/v1/recover).
 * Usa a chave anon (publishable) e redirect_to fixo de produção (APP_ORIGIN).
 */
export async function sendPasswordRecoveryToEmail(email) {
  const anon = config.supabasePublishableKey;
  if (!anon) {
    return { ok: false, status: 500, code: "missing_anon_key", body: "" };
  }
  const normalized = String(email || "").trim().toLowerCase();
  const recoverUrl = `${String(config.supabaseUrl).replace(/\/$/, "")}/auth/v1/recover`;
  const res = await fetch(recoverUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`
    },
    body: JSON.stringify({
      email: normalized,
      redirect_to: config.authInviteRedirectUrl
    })
  });
  const body = await res.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* texto plano */
  }
  return { ok: res.ok, status: res.status, json, body };
}
