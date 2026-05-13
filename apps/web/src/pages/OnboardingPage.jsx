import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { api, withAuth } from "../api";
import { useAuth } from "../auth/AuthProvider";

export default function OnboardingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const links = buildManagerSidebarLinks(navigate);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [notes, setNotes] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get("/catalog/stores", withAuth(token)).then((res) => {
      setStores(res.data || []);
      const first = res.data?.[0];
      if (first) {
        setStoreId(first.id);
        setName(first.name || "");
        setLocation(first.location || "");
        setPhone(first.phone || "");
        setOpeningHours(first.opening_hours || "");
        setManagerName(first.manager_name || "");
      }
    });
  }, [token]);

  function syncStoreSelection(nextStoreId) {
    setStoreId(nextStoreId);
    const store = stores.find((s) => s.id === nextStoreId);
    if (!store) return;
    setName(store.name || "");
    setLocation(store.location || "");
    setPhone(store.phone || "");
    setOpeningHours(store.opening_hours || "");
    setNotes(store.onboarding_notes || "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    await api.put(
      `/catalog/stores/${storeId}/onboarding`,
      { name, location, phone, openingHours, notes },
      withAuth(token)
    );
    setToast("Onboarding salvo com sucesso.");
    setTimeout(() => navigate("/manager"), 1000);
  }

  return (
    <AppShell title="Onboarding do Gerente" subtitle="Ola! Configure sua loja para comecar" links={links}>
      <section className="card">
        <h3>Configuracao inicial</h3>
        <div className="stepper">
          <span className={step === 1 ? "step active" : "step"}>Dados pessoais</span>
          <span className={step === 2 ? "step active" : "step"}>Configurar loja</span>
          <span className={step === 3 ? "step active" : "step"}>Confirmar</span>
        </div>
        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <>
              <div className="field">
                <label>Nome do gerente</label>
                <input value={managerName} onChange={(e) => setManagerName(e.target.value)} />
              </div>
              <div className="field">
                <label>Telefone do gerente</label>
                <input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} />
              </div>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <div className="field">
                <label>Loja</label>
                <select value={storeId} onChange={(e) => syncStoreSelection(e.target.value)}>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} (#{store.store_number})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Nome da loja</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Endereco</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="field">
                <label>Telefone da loja</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="field">
                <label>Horario de funcionamento</label>
                <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} />
              </div>
            </>
          ) : null}
          {step === 3 ? (
            <div className="card" style={{ borderTop: 0, boxShadow: "none", padding: 0 }}>
              <p>
                <strong>Gerente:</strong> {managerName}
              </p>
              <p>
                <strong>Telefone:</strong> {managerPhone || phone}
              </p>
              <p>
                <strong>Loja:</strong> {name}
              </p>
              <p>
                <strong>Endereco:</strong> {location}
              </p>
              <p>
                <strong>Horario:</strong> {openingHours}
              </p>
              <div className="field">
                <label>Observacoes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
              Voltar
            </button>
            <button className="btn btn-primary" type="submit">
              {step < 3 ? "Proximo" : "Confirmar e acessar painel"}
            </button>
          </div>
        </form>
      </section>
      {toast ? <div className="toast">{toast}</div> : null}
    </AppShell>
  );
}
