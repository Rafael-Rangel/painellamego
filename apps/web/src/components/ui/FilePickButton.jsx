import { useId, useRef } from "react";
import { FaFileAlt } from "react-icons/fa";

const DEFAULT_ACCEPT = ".jpg,.jpeg,.png,.pdf";

/**
 * Input de ficheiro estilizado como botão do site (input nativo oculto).
 */
export default function FilePickButton({
  buttonText = "Escolher arquivo(s)",
  accept = DEFAULT_ACCEPT,
  multiple = false,
  disabled = false,
  variant = "secondary",
  className = "",
  helper,
  onFilesSelected
}) {
  const inputRef = useRef(null);
  const inputId = useId();

  const handleChange = (e) => {
    const list = Array.from(e.target.files || []).filter(Boolean);
    if (list.length) onFilesSelected?.(list);
    e.target.value = "";
  };

  return (
    <div className={`file-pick ${className}`.trim()}>
      <button
        type="button"
        className={`btn btn-${variant} file-pick-btn`}
        disabled={disabled}
        aria-controls={inputId}
        onClick={() => inputRef.current?.click()}
      >
        <FaFileAlt className="file-pick-btn-icon" aria-hidden />
        <span>{buttonText}</span>
      </button>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="visually-hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        onChange={handleChange}
      />
      {helper ? <p className="file-pick-helper">{helper}</p> : null}
    </div>
  );
}
