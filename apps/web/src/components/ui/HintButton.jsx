/**
 * Botão com aparência clara de desativado e mensagem opcional para o utilizador.
 */
export default function HintButton({
  children,
  disabled = false,
  disabledReason,
  /** Quando true, o botão parece bloqueado mas ainda dispara onClick (ex.: validar ao clicar em Próximo). */
  allowClickWhenDisabled = false,
  variant = "primary",
  className = "",
  hintClassName = "",
  showHintWhenEnabled = false,
  ...props
}) {
  const variantClass =
    variant === "ghost"
      ? "btn-ghost"
      : variant === "secondary"
        ? "btn-secondary"
        : variant === "danger"
          ? "btn-danger"
          : variant === "muted"
            ? "btn-publish-unavailable"
            : "btn-primary";

  const locked = Boolean(disabled);
  const nativeDisabled = locked && !allowClickWhenDisabled;
  const showHint = (locked && disabledReason) || (showHintWhenEnabled && disabledReason);

  return (
    <div className={`hint-button ${hintClassName}`.trim()}>
      <button
        type="button"
        className={`btn ${variantClass} ${locked ? "btn--locked" : ""} ${className}`.trim()}
        disabled={nativeDisabled}
        aria-disabled={locked}
        title={locked ? disabledReason : props.title}
        {...props}
      >
        {children}
      </button>
      {showHint ? (
        <p className="hint-button__message" role="status">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
