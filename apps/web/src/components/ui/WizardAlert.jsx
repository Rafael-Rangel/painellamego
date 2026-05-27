import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";

const ICONS = {
  error: FaExclamationCircle,
  warning: FaExclamationTriangle,
  success: FaCheckCircle,
  info: FaInfoCircle
};

const TYPE_TITLES = {
  error: "Erro",
  warning: "Atenção",
  success: "Sucesso",
  info: "Informação"
};

/**
 * Card de feedback dentro do wizard (sucesso, erro, alerta ou info).
 */
export function WizardAlert({ type = "error", title, children, onDismiss, animate = true }) {
  const Icon = ICONS[type] || FaExclamationCircle;
  const displayTitle = title ?? TYPE_TITLES[type] ?? TYPE_TITLES.error;

  return (
    <div
      className={`wizard-alert wizard-alert--${type}${animate ? " wizard-alert--fade-in-left" : ""}`}
      role="alert"
    >
      <span className="wizard-alert__accent" aria-hidden />
      <Icon className="wizard-alert__icon" aria-hidden />
      <div className="wizard-alert__body">
        <p className="wizard-alert__title">{displayTitle}</p>
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
        <WizardAlert
          key={`${a.type}-${i}-${String(a.message).slice(0, 24)}`}
          type={a.type}
          title={a.title}
        >
          {a.message}
        </WizardAlert>
      ))}
    </div>
  );
}

/** Infere o tipo do aviso a partir do texto (fallback quando não há tipo explícito). */
export function toastKindFromMessage(message) {
  if (!message) return "info";
  const m = String(message).toLowerCase();

  if (
    m.includes("sucesso") ||
    m.includes("guardado") ||
    m.includes("guardada") ||
    m.includes("atualizado") ||
    m.includes("atualizada") ||
    m.includes("removido") ||
    m.includes("removida") ||
    m.includes("publicada") ||
    m.includes("publicado") ||
    m.includes("enviad") ||
    m.includes("adicionad") ||
    m.includes("concluíd") ||
    m.includes("concluid") ||
    m.includes("criado") ||
    m.includes("criada")
  ) {
    return "success";
  }

  if (
    m.includes("não foi possível") ||
    m.includes("nao foi possivel") ||
    m.includes("falha") ||
    m.includes("erro") ||
    m.includes("inválid") ||
    m.includes("invalid")
  ) {
    return "error";
  }

  if (
    m.includes("informe") ||
    m.includes("selecione") ||
    m.includes("revise") ||
    m.includes("complete") ||
    m.includes("ajuste") ||
    m.includes("não pode") ||
    m.includes("nao pode") ||
    m.includes("zerado") ||
    m.includes("pelo menos")
  ) {
    return "warning";
  }

  if (m.includes("opcional") || m.includes("pode ") || m.includes("toque em")) return "info";

  return "warning";
}
