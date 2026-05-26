export default function DataCard({ title, subtitle, actions, children, footer, className = "" }) {
  return (
    <section className={["card", "data-card", className].filter(Boolean).join(" ")}>
      <header className="data-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="data-card-actions">{actions}</div> : null}
      </header>
      <div className="data-card-body">{children}</div>
      {footer ? <footer className="data-card-footer">{footer}</footer> : null}
    </section>
  );
}
