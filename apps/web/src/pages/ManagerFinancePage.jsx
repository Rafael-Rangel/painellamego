import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaCheck, FaGift, FaMoneyBillWave } from "react-icons/fa";
import AppShell from "../components/AppShell";
import { buildManagerSidebarLinks } from "../config/managerNavLinks";
import { useAuth } from "../auth/AuthProvider";
import { api, withAuth } from "../api";
import { formatCurrency } from "../lib/formatters";
import KpiCardCompact from "../components/ui/KpiCardCompact";

const MONTHS_PT = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" }
];

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i);

function monthKeyFromDueDate(dueDate) {
  return String(dueDate || "").slice(0, 7);
}

function monthTitle(ym) {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

function groupInstallmentsByMonth(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = monthKeyFromDueDate(row.due_date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      title: monthTitle(key),
      items,
      subtotal: items.reduce((s, r) => s + Number(r.amount || 0), 0)
    }));
}

function PayableRow({ row, onMarkPaid }) {
  const invoice = row.purchases?.invoice_number || "n/d";
  return (
    <li className="finance-payable-row">
      <div>
        <strong>NF {invoice}</strong>
        <span className="finance-payable-meta">
          Vence {new Date(row.due_date + "T12:00:00").toLocaleDateString("pt-BR")} · Parcela {row.installment_number}
          {row.installment_number === 1 ? null : " (próxima)"}
        </span>
      </div>
      <div className="finance-payable-actions">
        <span>{formatCurrency(row.amount)}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMarkPaid(row.id)} title="Marcar como pago">
          <FaCheck aria-hidden />
          <span className="visually-hidden">Marcar pago</span>
        </button>
      </div>
    </li>
  );
}

export default function ManagerFinancePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [payables, setPayables] = useState(null);
  const [bonus, setBonus] = useState(null);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [tab, setTab] = useState("payables");

  const links = useMemo(() => buildManagerSidebarLinks(navigate), [navigate]);

  const loadPayables = useCallback(async () => {
    const { data } = await api.get("/finance/payables?days=120", withAuth(token));
    setPayables(data);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadPayables().catch(() => setPayables({ installments: [], overdue: [], summary: {} }));
    api
      .get(`/finance/bonification?year=${year}&month=${month}`, withAuth(token))
      .then((r) => setBonus(r.data))
      .catch(() => setBonus({ rows: [], totalBonusValue: 0 }));
  }, [token, year, month, loadPayables]);

  const upcomingByMonth = useMemo(
    () => groupInstallmentsByMonth(payables?.installments || []),
    [payables?.installments]
  );

  const markPaid = async (id) => {
    await api.patch(`/finance/installments/${id}`, { status: "paid" }, withAuth(token));
    await loadPayables();
  };

  return (
    <AppShell title="Financeiro" subtitle="Próximos vencimentos e bonificações" links={links} activeLinkKey="finance">
      <div className="finance-page">
        <div className="finance-tabs" role="tablist">
          <button type="button" className={tab === "payables" ? "finance-tab-active" : ""} onClick={() => setTab("payables")}>
            <FaMoneyBillWave /> A pagar
          </button>
          <button type="button" className={tab === "bonus" ? "finance-tab-active" : ""} onClick={() => setTab("bonus")}>
            Bonificações
          </button>
        </div>

        {tab === "payables" ? (
          <section className="card finance-section">
            <h2>Próximos vencimentos</h2>
            <p className="finance-section-lead">
              Ao publicar a nota, a <strong>1ª parcela</strong> é considerada já paga. Aqui aparecem só as parcelas
              seguintes (2ª, 3ª…), agrupadas por mês de vencimento.
            </p>
            {payables?.summary ? (
              <p className="finance-summary">
                Próximos 120 dias: <strong>{formatCurrency(payables.summary.pending)}</strong>
                {payables.summary.overdue > 0 ? (
                  <>
                    {" "}
                    · <span className="finance-overdue">Em atraso: {formatCurrency(payables.summary.overdue)}</span>
                  </>
                ) : null}
              </p>
            ) : null}

            {(payables?.overdue || []).length > 0 ? (
              <div className="finance-month-block finance-month-block--overdue">
                <h3 className="finance-month-title finance-month-title--overdue">Vencidos (atrasados)</h3>
                <ul className="finance-payables-list">
                  {(payables.overdue || []).map((row) => (
                    <PayableRow key={row.id} row={row} onMarkPaid={markPaid} />
                  ))}
                </ul>
              </div>
            ) : null}

            {upcomingByMonth.length > 0 ? (
              upcomingByMonth.map((group) => (
                <div key={group.key} className="finance-month-block">
                  <h3 className="finance-month-title">
                    {group.title}
                    <span className="finance-month-subtotal">{formatCurrency(group.subtotal)}</span>
                  </h3>
                  <ul className="finance-payables-list">
                    {group.items.map((row) => (
                      <PayableRow key={row.id} row={row} onMarkPaid={markPaid} />
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="subtitle">Nenhuma parcela futura pendente nos próximos meses.</p>
            )}
          </section>
        ) : (
          <section className="card finance-section finance-section--bonus">
            <header className="finance-section-head">
              <div className="finance-section-head__icon" aria-hidden>
                <FaGift />
              </div>
              <div>
                <h2>Bonificação no mês</h2>
                <p className="finance-section-lead">Consulte o valor de referência das bonificações lançadas nas notas.</p>
              </div>
            </header>

            <div className="finance-period-card">
              <div className="finance-period-card__label">
                <FaCalendarAlt aria-hidden />
                <span>Período</span>
              </div>
              <div className="finance-period-fields">
                <div className="field finance-period-field">
                  <label htmlFor="bonus-month">Mês</label>
                  <select
                    id="bonus-month"
                    className="finance-period-input"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {MONTHS_PT.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field finance-period-field">
                  <label htmlFor="bonus-year">Ano</label>
                  <select
                    id="bonus-year"
                    className="finance-period-input"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="finance-bonus-kpi">
              <KpiCardCompact
                label="Total bonificado (referência)"
                value={formatCurrency(bonus?.totalBonusValue || 0)}
                hint={`${MONTHS_PT.find((m) => m.value === month)?.label || month} de ${year}`}
              />
            </div>

            {(bonus?.rows || []).length > 0 ? (
              <ul className="finance-bonus-list">
                {(bonus?.rows || []).map((row, idx) => (
                  <li key={idx} className="finance-bonus-row">
                    <div className="finance-bonus-row__main">
                      <strong>{row.productName}</strong>
                      <span className="finance-bonus-row__category">{row.category}</span>
                    </div>
                    <div className="finance-bonus-row__detail">
                      <span className="finance-payable-meta">NF {row.invoiceNumber}</span>
                      <span className="finance-bonus-row__amount">
                        {row.bonusQuantity} un × {formatCurrency(row.bonusUnitValue)} ={" "}
                        <strong>{formatCurrency(row.totalValue)}</strong>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="finance-empty" role="status">
                <FaGift className="finance-empty__icon" aria-hidden />
                <p className="finance-empty__title">Sem bonificação neste mês</p>
                <p className="finance-empty__text">
                  Não há linhas de bonificação em notas de {MONTHS_PT.find((m) => m.value === month)?.label?.toLowerCase()}{" "}
                  de {year}. Altere o período ou registe bonificações ao lançar compras.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
