import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { authErrorMessage } from "../auth/messages";

const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL ?? "/logo.jpg";

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
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (supabaseError) throw supabaseError;
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <section className="login-card">
        <img className="login-logo" src={logoUrl} alt="Logo Lamego" />
        <h2 style={{ marginTop: 0 }}>Recuperar senha</h2>
        <p className="subtitle">Enviamos um link no seu e-mail para criar uma nova senha.</p>

        {sent ? (
          <div className="login-success" role="status">
            <p>
              <strong>Pronto!</strong> Se este e-mail estiver cadastrado, em alguns minutos você
              receberá um link para redefinir a senha.
            </p>
            <p className="subtitle" style={{ marginTop: "0.6rem" }}>
              Verifique também a caixa de spam.
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
