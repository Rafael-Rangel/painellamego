import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { authErrorMessage } from "../auth/messages";

const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL ?? "/logo.jpg";

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/manager"} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      const fallback = location.state?.from || "/manager";
      navigate(fallback);
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
        <h2 style={{ marginTop: 0 }}>Acesse sua conta</h2>
        <p className="subtitle">Plataforma interna de compras - Rede Lamego</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@lamego.com.br"
              disabled={loading}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Senha</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
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
            <span>{loading ? "Entrando..." : "Entrar"}</span>
          </button>
        </form>

        <div className="login-extra">
          <Link to="/forgot-password" className="login-link">
            Esqueci minha senha
          </Link>
        </div>

        <p className="footer-note">Rede Lamego © 2026</p>
      </section>
    </div>
  );
}
