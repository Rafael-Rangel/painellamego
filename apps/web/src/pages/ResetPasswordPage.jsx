import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { authErrorMessage } from "../auth/messages";

const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL ?? "/logo.jpg";

/**
 * Recebe o redirect do Supabase após clicar no link de recuperação.
 * O Supabase JS coloca o token em hash; quando processado, dispara
 * o evento PASSWORD_RECOVERY (e o usuário fica numa "sessão recuperação").
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [readyForReset, setReadyForReset] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReadyForReset(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReadyForReset(true);
      }
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (password.length < 8) {
      setError("A nova senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem. Confirme a nova senha.");
      return;
    }
    setLoading(true);
    try {
      const { error: supabaseError } = await supabase.auth.updateUser({ password });
      if (supabaseError) throw supabaseError;
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
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
        <h2 style={{ marginTop: 0 }}>Definir nova senha</h2>
        <p className="subtitle">Escolha uma senha forte para sua conta.</p>

        {done ? (
          <div className="login-success" role="status">
            <p>
              <strong>Senha alterada com sucesso!</strong> Você será redirecionado para o login.
            </p>
          </div>
        ) : !readyForReset ? (
          <p className="empty">
            Verificando o link de recuperação... Se demorar, abra novamente o link mais recente
            recebido no seu e-mail.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="reset-password">Nova senha</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 8 caracteres"
                disabled={loading}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirmar senha</label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
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
              <span>{loading ? "Salvando..." : "Salvar nova senha"}</span>
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
