import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaMoon, FaSun, FaTimes } from "react-icons/fa";
import { useAuth } from "../auth/AuthProvider";

const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL ?? "/logo.jpg";

export default function AppShell({
  title,
  subtitle,
  children,
  links = [],
  activeLinkKey = "",
  storeBadge,
  sidebarTitle = "Admin tools",
  /** Classe extra no `<nav>` do menu (ex.: tipografia mais compacta no admin). */
  sidebarNavClass = ""
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("lamego-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  });

  const storeLabel = useMemo(() => {
    if (storeBadge !== undefined) return storeBadge ?? "Sua loja";
    if (user?.storeId) return `Loja: ${user.storeId}`;
    return "Visao de rede";
  }, [storeBadge, user?.storeId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("lamego-theme", theme);
  }, [theme]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <button
            className="btn btn-ghost sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <FaBars />
          </button>
          <img src={logoUrl} alt="Logo Lamego" />
          <div>
            <h1>{title}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-search">
            <input placeholder="Buscar no painel..." aria-label="Buscar no painel" />
          </div>
          <button
            className="btn btn-ghost theme-toggle"
            type="button"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label="Alternar tema"
            title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {theme === "dark" ? <FaSun /> : <FaMoon />}
          </button>
          <span className="topbar-pill">{storeLabel}</span>
          <span className="topbar-user">{user?.email}</span>
          <button className="btn btn-secondary" onClick={handleSignOut}>
            Sair
          </button>
        </div>
      </header>
      <main className="container app-layout">
        <div
          className={sidebarOpen ? "sidebar-overlay sidebar-overlay-open" : "sidebar-overlay"}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />
        <aside className={sidebarOpen ? "sidebar sidebar-drawer sidebar-drawer-open" : "sidebar sidebar-drawer"}>
          <div className="sidebar-drawer-head">
            <h4>{sidebarTitle}</h4>
            <button className="btn btn-ghost sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
              <FaTimes />
            </button>
          </div>
          <nav className={sidebarNavClass || undefined}>
            {links.map((link) =>
              link.onClick ? (
                <button
                  key={link.key || link.label}
                  type="button"
                  className={activeLinkKey === link.key ? "nav active nav-btn" : "nav nav-btn"}
                  onClick={link.onClick}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              ) : (
                <NavLink
                  key={`${link.to}-${link.label}`}
                  to={link.to}
                  end={link.end === true}
                  onClick={link.onNavClick}
                  className={({ isActive }) => (isActive ? "nav active" : "nav")}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </NavLink>
              )
            )}
          </nav>
          <div className="sidebar-footer">
            <small>Rede Lamego</small>
            <p>Painel interno de compras</p>
          </div>
        </aside>
        <section className="app-main-section" key={location.pathname}>
          {children}
        </section>
      </main>
    </div>
  );
}
