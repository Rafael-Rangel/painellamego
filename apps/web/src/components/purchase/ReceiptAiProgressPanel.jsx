import { FaRedo } from "react-icons/fa";
import { RECEIPT_AI_STAGES, stageIndex } from "../../lib/receiptAiStages";

export default function ReceiptAiProgressPanel({
  visible,
  stage,
  progress = 0,
  message = "",
  error = "",
  retryCount = 0,
  onRetry
}) {
  if (!visible && !error) return null;

  const activeIdx = stage ? stageIndex(stage) : 0;

  return (
    <div className="purchase-ai-progress card" role="status" aria-live="polite">
      {error ? (
        <div className="purchase-ai-progress-error">
          <p className="purchase-ai-progress-error-text">{error}</p>
          {onRetry ? (
            <button type="button" className="btn btn-secondary purchase-ai-retry-btn" onClick={onRetry}>
              <FaRedo aria-hidden style={{ marginRight: "0.35rem" }} />
              Tentar novamente
              {retryCount > 0 ? ` (${retryCount + 1}ª tentativa)` : ""}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="purchase-ai-progress-bar-track" aria-hidden>
            <div className="purchase-ai-progress-bar-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <p className="purchase-ai-progress-pct">{Math.round(progress)}%</p>
          <ol className="purchase-ai-progress-steps">
            {RECEIPT_AI_STAGES.map((s, idx) => {
              let state = "pending";
              if (idx < activeIdx) state = "done";
              else if (idx === activeIdx) state = "active";
              return (
                <li key={s.id} className={`purchase-ai-progress-step purchase-ai-progress-step--${state}`}>
                  <span className="purchase-ai-progress-step-dot" aria-hidden />
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {message ? <p className="purchase-ai-progress-msg">{message}</p> : null}
        </>
      )}
    </div>
  );
}
