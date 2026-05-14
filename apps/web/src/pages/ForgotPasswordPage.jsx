import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { authErrorMessage } from "../auth/messages";

const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL ?? "/logo.jpg";

/**
 * Recuperação de senha via API Lamego → Supabase /auth/v1/recover.
 * O redirect_to usa APP_ORIGIN no servidor (evita link com localhost).
 * Limite: 5 pedidos / 15 min por IP na API + limites do próprio Supabase.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === "string" && msg.length ? msg : authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <section className="login-card">
        <img className="login-logo" src={logoUrl} alt="Logo Lamego" />
        <h2 style={{ marginTop: 0 }}>Recuperar senha</h2>
        <p className="subtitle">
          Enviaremos um link seguro no seu e-mail (serviço Auth do Supabase). Por segurança, não dizemos se o e-mail existe ou não na
          resposta de sucesso.
        </p>

        {sent ? (
          <div className="login-success" role="status">
            <p>
              <strong>Se este e-mail estiver cadastrado,</strong> em alguns minutos você receberá um link para redefinir a senha na página
              do painel.
            </p>
            <p className="subtitle" style={{ marginTop: "0.6rem" }}>
              Verifique também a caixa de spam. Se nada chegar, o limite de e-mails do projeto pode ter sido atingido — aguarde cerca de 1
              hora ou peça ao administrador para configurar SMTP no Supabase.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="forgot-email">E-mail</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@lamego.com.br"
                disabled={loading}
                required
              />
            </div>

            {error ? (
              <p className="field-error" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}

            <button
              className="btn btn-primary login-submit"
              style={{ width: "100%" }}
              type="submit"
              disabled={loading}
            >
              {loading ? <span className="login-spinner" aria-hidden /> : null}
              <span>{loading ? "Enviando..." : "Enviar link de recuperação"}</span>
            </button>
          </form>
        )}

        <div className="login-extra">
          <Link to="/login" className="login-link">
            Voltar ao login
          </Link>
        </div>

        <p className="footer-note">Rede Lamego © 2026</p>
      </section>
    </div>
  );
}
