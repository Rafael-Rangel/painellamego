import { useCallback, useRef } from "react";
import { FaCloudUploadAlt, FaFileAlt } from "react-icons/fa";
import { MdAutoAwesome } from "react-icons/md";

const ACCEPT = ".jpg,.jpeg,.png,.pdf";

/**
 * Card de upload com drag-and-drop para análise de nota por IA.
 * Notifica o pai com a lista de ficheiros (o pai dispara a análise).
 */
export default function ReceiptAiDropzoneCard({ disabled, analyzing, fileNames = [], onFilesChange }) {
  const inputRef = useRef(null);

  const mergeFiles = useCallback(
    (incoming) => {
      const list = Array.from(incoming || []).filter(Boolean);
      if (!list.length) return;
      onFilesChange(list);
    },
    [onFilesChange]
  );

  const onInputChange = (e) => {
    mergeFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || analyzing) return;
    mergeFiles(e.dataTransfer?.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={`purchase-ai-upload-card card ${analyzing ? "purchase-ai-upload-card-analyzing" : ""}`}>
      <div className="purchase-ai-upload-head">
        <span className="purchase-ai-upload-icon" aria-hidden>
          <MdAutoAwesome aria-hidden />
        </span>
        <div>
          <h3 className="purchase-ai-upload-title">Analisar com IA</h3>
          <p className="purchase-ai-upload-lead">
            Envie <strong>pelo menos um</strong> arquivo da nota (obrigatório). Pode selecionar vários de uma vez na área
            principal. A leitura por IA inicia automaticamente após o envio.
          </p>
        </div>
      </div>

      <div
        className="purchase-ai-dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="button"
        tabIndex={0}
        aria-busy={analyzing}
        aria-label="Área para soltar ficheiros da nota fiscal"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !analyzing) inputRef.current?.click();
          }
        }}
      >
        {analyzing ? (
          <div className="purchase-ai-dropzone-overlay" aria-live="polite">
            <div className="purchase-ai-spinner" aria-hidden />
            <p className="purchase-ai-analyze-msg">A preparar e analisar a nota… veja o progresso abaixo.</p>
          </div>
        ) : null}
        <FaCloudUploadAlt className="purchase-ai-dropzone-graphic" aria-hidden />
        <p className="purchase-ai-dropzone-hint">Solte os ficheiros aqui</p>
        <button
          type="button"
          className="btn btn-secondary purchase-ai-select-btn file-pick-btn"
          disabled={disabled || analyzing}
          onClick={() => inputRef.current?.click()}
        >
          <FaFileAlt className="file-pick-btn-icon" aria-hidden />
          <span>Selecionar arquivo(s)</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          accept={ACCEPT}
          multiple
          onChange={onInputChange}
          disabled={disabled || analyzing}
        />
        <p className="purchase-ai-dropzone-meta">
          Tire ou escolha a foto da nota (JPG/PNG) · o sistema ajusta o envio automaticamente, sem precisar ver o tamanho em MB
        </p>
      </div>

      {fileNames.length > 0 ? (
        <div className="purchase-ai-file-list" role="status">
          <FaFileAlt aria-hidden style={{ marginRight: "0.35rem", opacity: 0.85 }} />
          <span>
            {fileNames.length} arquivo(s): {fileNames.join(", ")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
