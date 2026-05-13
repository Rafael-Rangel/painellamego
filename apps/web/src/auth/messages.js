/** Traduz mensagens de erro do Supabase Auth para PT-BR amigáveis. */
export function authErrorMessage(err) {
  const raw = (err?.message || "").toString().toLowerCase();
  if (!raw) return "Não foi possível entrar. Tente novamente em alguns instantes.";

  if (raw.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (raw.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (raw.includes("user not found")) return "Não encontramos uma conta com esse e-mail.";
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (raw.includes("password") && raw.includes("weak")) {
    return "Senha muito fraca. Use ao menos 8 caracteres com letras e números.";
  }
  if (raw.includes("invalid email")) return "Informe um e-mail válido.";
  if (raw.includes("network") || raw.includes("fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  return err?.message || "Não foi possível concluir a operação.";
}
