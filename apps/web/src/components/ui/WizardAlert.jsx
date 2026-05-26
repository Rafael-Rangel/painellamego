import { FaCheckCircle, FaExclamationCircle, FaInfoCircle } from "react-icons/fa";

const ICONS = {
  error: FaExclamationCircle,
  warning: FaExclamationCircle,
  success: FaCheckCircle,
  info: FaInfoCircle
};

/**
 * Aviso visível dentro do card do wizard (vermelho claro para erros/bloqueios).
 */
export function WizardAlert({ type = "error", title, children, onDismiss }) {
  const Icon = ICONS[type] || FaExclamationCircle;
  return (
    <div className={`wizard-alert wizard-alert--${type}`} role="alert">
      <Icon className="wizard-alert__icon" aria-hidden />
      <div className="wizard-alert__body">
        {title ? <p className="wizard-alert__title">{title}</p> : null}
        <div className="wizard-alert__text">{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" className="wizard-alert__close btn btn-ghost btn-sm" onClick={onDismiss} aria-label="Fechar aviso">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function WizardAlerts({ alerts = [] }) {
  if (!alerts?.length) return null;
  return (
    <div className="wizard-alerts" aria-live="polite">
      {alerts.map((a, i) => (
        <WizardAlert key={`${a.type}-${i}-${String(a.message).slice(0, 24)}`} type={a.type} title={a.title}>
          {a.message}
        </WizardAlert>
      ))}
    </div>
  );
}

export function toastKindFromMessage(message) {
  if (!message) return "info";
  const m = String(message).toLowerCase();
  if (m.includes("sucesso") || m.includes("guardado") || m.includes("atualizado") || m.includes("removido") || m.includes("publicada")) {
    return "success";
  }
  if (m.includes("opcional") || m.includes("pode ")) return "info";
  return "error";
}
