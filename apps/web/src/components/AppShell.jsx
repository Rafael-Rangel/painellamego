import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaSignOutAlt, FaTimes } from "react-icons/fa";
import { useAuth } from "../auth/AuthProvider";

const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL ?? "/logo.jpg";

export default function AppShell({
  title,
  subtitle,
  children,
  links = [],
  activeLinkKey = "",
  storeBadge
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const storeLabel = useMemo(() => {
    if (storeBadge !== undefined) return storeBadge ?? "Sua loja";
    if (user?.storeId) return `Loja: ${user.storeId}`;
    return "";
  }, [storeBadge, user?.storeId]);

  useEffect(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("lamego-theme");
  }, []);

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
          <img src={logoUrl} alt="Logo Lamego" />
          <div>
            <h1>{title}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="topbar-actions">
          {storeLabel ? <span className="topbar-pill topbar-pill--desktop">{storeLabel}</span> : null}
          <span className="topbar-user topbar-user--desktop">{user?.email}</span>
          <button className="btn btn-secondary topbar-signout--desktop" type="button" onClick={handleSignOut}>
            Sair
          </button>
          <button
            className="btn btn-ghost sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <FaBars />
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
            <button className="btn btn-ghost sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
              <FaTimes />
            </button>
          </div>
          <nav>
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
          <div className="sidebar-account">
            {storeLabel ? <span className="sidebar-account-pill">{storeLabel}</span> : null}
            <span className="sidebar-account-email">{user?.email}</span>
            <button className="btn btn-menu-signout sidebar-account-signout" type="button" onClick={handleSignOut}>
              <FaSignOutAlt aria-hidden />
              <span>Sair</span>
            </button>
          </div>
        </aside>
        <section className="app-main-section" key={location.pathname}>
          {children}
        </section>
      </main>
    </div>
  );
}
