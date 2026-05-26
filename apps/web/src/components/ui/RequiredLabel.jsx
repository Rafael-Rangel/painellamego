/**
 * Rótulo de campo com asterisco vermelho para obrigatórios.
 */
export default function RequiredLabel({ htmlFor, children, required = false, className = "" }) {
  return (
    <label htmlFor={htmlFor} className={className || undefined}>
      {children}
      {required ? (
        <span className="field-required" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldValidationMessage({ id, children, className = "" }) {
  if (!children) return null;
  return (
    <p className={`field-validation-msg ${className}`.trim()} id={id} role="alert">
      {children}
    </p>
  );
}
