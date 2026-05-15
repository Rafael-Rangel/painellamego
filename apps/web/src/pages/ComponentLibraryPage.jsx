import AppShell from "../components/AppShell";
import { FaPuzzlePiece } from "react-icons/fa";

export default function ComponentLibraryPage() {
  const links = [{ to: "/design-system", label: "Design System", icon: <FaPuzzlePiece /> }];

  return (
    <AppShell title="Component Library" subtitle="Biblioteca visual de componentes" links={links}>
      <div className="grid">
        <section className="card span-12">
          <h3>Tokens</h3>
          <p className="subtitle">Cores, espacos, tipografia e elevacoes definidos em tokens.css</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge" style={{ background: "#3D0A0A", color: "white" }}>
              #3D0A0A
            </span>
            <span className="badge" style={{ background: "#C0392B", color: "white" }}>
              #C0392B
            </span>
            <span className="badge" style={{ background: "#F0A500", color: "#101828" }}>
              #F0A500
            </span>
          </div>
        </section>
        <section className="card span-6">
          <h3>Atoms - Buttons</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-danger">Danger</button>
            <button className="btn btn-primary" disabled>
              Disabled
            </button>
          </div>
        </section>
        <section className="card span-6">
          <h3>Atoms - Inputs e Badges</h3>
          <div className="field">
            <label>Input default</label>
            <input placeholder="Texto..." />
            <span className="field-helper">Helper text</span>
          </div>
          <span className="badge badge-success">SUCCESS</span>{" "}
          <span className="badge badge-warning">WARNING</span>{" "}
          <span className="badge badge-danger">ERROR</span>{" "}
          <span className="badge badge-info">INFO</span>
        </section>
        <section className="card span-6">
          <h3>Molecules</h3>
          <div className="stat">
            <span>KPI Card</span>
            <strong>R$ 12.432,90</strong>
            <span className="badge badge-success">+8,2%</span>
          </div>
          <div className="card" style={{ marginTop: "0.7rem" }}>
            <strong>Alert Card</strong>
            <p className="subtitle">Farinha de trigo 18% acima da media da rede.</p>
            <span className="badge badge-danger">Acao sugerida</span>
          </div>
        </section>
        <section className="card span-6">
          <h3>Organisms</h3>
          <div className="table-wrap table-wrap--mobile">
            <table>
              <thead>
                <tr>
                  <th>
                    <span className="table-th-label">Produto</span>
                  </th>
                  <th>
                    <span className="table-th-label">Preco</span>
                  </th>
                  <th>
                    <span className="table-th-label">Status</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="table-cell-clamp">Farinha de trigo</div>
                  </td>
                  <td>
                    <div className="table-cell-clamp">R$ 4,90</div>
                  </td>
                  <td>
                    <div className="table-cell-clamp">
                      <span className="badge badge-warning">Acima da media</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div className="table-cell-clamp">Manteiga</div>
                  </td>
                  <td>
                    <div className="table-cell-clamp">R$ 28,10</div>
                  </td>
                  <td>
                    <div className="table-cell-clamp">
                      <span className="badge badge-success">Dentro da meta</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
