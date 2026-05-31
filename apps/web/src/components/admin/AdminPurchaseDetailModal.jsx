import { useEffect, useState } from "react";
import { FaExternalLinkAlt, FaTimes } from "react-icons/fa";
import { api, withAuth } from "../api";
import CompactTable from "./ui/CompactTable";
import { formatCurrency } from "../lib/formatters";

function formatDate(value) {
  if (!value) return "n/d";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) return "n/d";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`purchase-detail-summary__row${strong ? " purchase-detail-summary__row--strong" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function AdminPurchaseDetailModal({ purchaseId, token, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!purchaseId || !token) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    (async () => {
      try {
        const { data } = await api.get(`/purchases/${purchaseId}/detail`, withAuth(token));
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Não foi possível carregar os detalhes da nota.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseId, token]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title" onClick={onClose}>
      <div className="modal modal--purchase-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h3 id="purchase-detail-title">Detalhes da nota</h3>
            {detail ? (
              <p className="field-helper" style={{ margin: 0 }}>
                NF {detail.invoiceNumber || "n/d"} · {detail.store?.name || "Loja"} · {formatDateTime(detail.createdAt)}
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            <FaTimes aria-hidden />
          </button>
        </div>

        {loading ? <p className="field-helper">A carregar detalhes…</p> : null}
        {error ? <p className="field-validation-msg field-validation-msg--error">{error}</p> : null}

        {!loading && detail ? (
          <div className="purchase-detail-modal__body">
            <section className="purchase-detail-section">
              <h4>Dados gerais</h4>
              <dl className="purchase-detail-dl">
                <div>
                  <dt>Loja</dt>
                  <dd>
                    {detail.store?.storeNumber != null ? `${detail.store.storeNumber} · ` : ""}
                    {detail.store?.name || "n/d"}
                  </dd>
                </div>
                <div>
                  <dt>Fornecedor</dt>
                  <dd>{detail.supplierName || "n/d"}</dd>
                </div>
                <div>
                  <dt>Nota fiscal</dt>
                  <dd>{detail.invoiceNumber || "n/d"}</dd>
                </div>
                <div>
                  <dt>Registada em</dt>
                  <dd>{formatDateTime(detail.createdAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="purchase-detail-section">
              <h4>Resumo financeiro</h4>
              <div className="purchase-detail-summary">
                <SummaryRow label="Produtos sem bonificação" value={formatCurrency(detail.totals.totalPayable)} />
                <SummaryRow
                  label="Produtos com bonificação (referência)"
                  value={formatCurrency(detail.totals.totalBonusValue)}
                />
                <SummaryRow label="Total de impostos" value={formatCurrency(detail.totals.totalTaxes)} />
                <SummaryRow label="Total de extras" value={formatCurrency(detail.totals.totalExtras)} />
                <SummaryRow label="Valor total da nota" value={formatCurrency(detail.totals.grandTotal)} strong />
              </div>
            </section>

            {detail.taxes?.length ? (
              <section className="purchase-detail-section">
                <h4>Impostos</h4>
                <ul className="purchase-detail-lines">
                  {detail.taxes.map((row, idx) => (
                    <li key={`tax-${idx}`}>
                      <span>{row.name}</span>
                      <strong>{formatCurrency(row.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.extras?.length ? (
              <section className="purchase-detail-section">
                <h4>Extras</h4>
                <ul className="purchase-detail-lines">
                  {detail.extras.map((row, idx) => (
                    <li key={`extra-${idx}`}>
                      <span>{row.name}</span>
                      <strong>{formatCurrency(row.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="purchase-detail-section">
              <h4>Itens da nota</h4>
              <CompactTable
                scrollHorizontal
                maxHeight={280}
                rows={detail.items}
                keyField="id"
                emptyMessage="Sem itens."
                columns={[
                  { id: "productName", label: "Produto", clamp: false },
                  { id: "category", label: "Categoria", render: (r) => r.category || "n/d" },
                  {
                    id: "lineType",
                    label: "Tipo",
                    render: (r) => (r.lineType === "venda" ? "Venda" : "Insumo")
                  },
                  {
                    id: "bonif",
                    label: "Bonif.",
                    render: (r) => (r.isBonificationOnly ? "Sim" : "Não")
                  },
                  {
                    id: "qty",
                    label: "Qtd.",
                    render: (r) => `${r.quantity} ${r.unitUsed || ""}`.trim()
                  },
                  {
                    id: "unitPrice",
                    label: "Preço un.",
                    render: (r) => formatCurrency(r.unitPrice)
                  },
                  {
                    id: "chargeTotal",
                    label: "Total pago",
                    render: (r) => formatCurrency(r.chargeTotal)
                  },
                  {
                    id: "bonusRefTotal",
                    label: "Ref. bonif.",
                    render: (r) => (r.bonusRefTotal > 0 ? formatCurrency(r.bonusRefTotal) : "—")
                  }
                ]}
              />
            </section>

            {detail.installments?.length ? (
              <section className="purchase-detail-section">
                <h4>Vencimentos</h4>
                <CompactTable
                  scrollHorizontal
                  maxHeight={220}
                  rows={detail.installments}
                  keyField="number"
                  emptyMessage="Sem parcelas."
                  columns={[
                    { id: "number", label: "Parcela", render: (r) => r.number },
                    { id: "dueDate", label: "Vencimento", render: (r) => formatDate(r.dueDate) },
                    { id: "amount", label: "Valor", render: (r) => formatCurrency(r.amount) },
                    { id: "status", label: "Status", render: (r) => r.status || "n/d" }
                  ]}
                />
              </section>
            ) : null}

            {detail.notes?.trim() ? (
              <section className="purchase-detail-section">
                <h4>Observações</h4>
                <p className="purchase-detail-notes">{detail.notes.trim()}</p>
              </section>
            ) : null}

            {detail.receipts?.length ? (
              <section className="purchase-detail-section">
                <h4>Anexos da nota</h4>
                <ul className="purchase-detail-receipts">
                  {detail.receipts.map((rec) => (
                    <li key={rec.id}>
                      <span>{rec.originalName || "Anexo"}</span>
                      {rec.url ? (
                        <a href={rec.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          Abrir <FaExternalLinkAlt aria-hidden style={{ marginLeft: "0.35rem" }} />
                        </a>
                      ) : (
                        <span className="field-helper">Indisponível</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        <div className="modal__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
