import { useCallback, useEffect, useRef, useState } from "react";
import { FaCamera, FaCloudUploadAlt, FaFileAlt, FaTimes, FaTrash } from "react-icons/fa";
import { MdAutoAwesome } from "react-icons/md";
import { formatFileSize } from "../../lib/compressReceiptImages";
import { MAX_RECEIPT_FILES } from "../../lib/receiptFiles";

const ACCEPT = ".jpg,.jpeg,.png,.pdf";

/**
 * Upload de notas para IA: acumula várias fotos (câmera uma a uma ou galeria) antes de analisar.
 */
export default function ReceiptAiDropzoneCard({
  disabled,
  analyzing,
  receipts = [],
  onAppendFiles,
  onRemoveFile,
  onClearFiles,
  onAnalyze
}) {
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [previewUrls, setPreviewUrls] = useState([]);

  const atLimit = receipts.length >= MAX_RECEIPT_FILES;

  useEffect(() => {
    const urls = receipts.map((f) =>
      f.type?.startsWith("image/") ? URL.createObjectURL(f) : null
    );
    setPreviewUrls(urls);
    return () => {
      for (const u of urls) {
        if (u) URL.revokeObjectURL(u);
      }
    };
  }, [receipts]);

  const appendFromInput = useCallback(
    (fileList) => {
      const list = Array.from(fileList || []).filter(Boolean);
      if (!list.length) return;
      onAppendFiles?.(list);
    },
    [onAppendFiles]
  );

  const onGalleryChange = (e) => {
    appendFromInput(e.target.files);
    e.target.value = "";
  };

  const onCameraChange = (e) => {
    appendFromInput(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || analyzing || atLimit) return;
    appendFromInput(e.dataTransfer?.files);
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
            Tire <strong>várias fotos</strong> da nota (uma de cada vez pela câmera) ou escolha ficheiros na galeria.
            Quando tiver todas as páginas, toque em <strong>Analisar com IA</strong>.
          </p>
        </div>
      </div>

      <div
        className="purchase-ai-dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="region"
        aria-busy={analyzing}
        aria-label="Área para adicionar ficheiros da nota fiscal"
      >
        {analyzing ? (
          <div className="purchase-ai-dropzone-overlay" aria-live="polite">
            <div className="purchase-ai-spinner" aria-hidden />
            <p className="purchase-ai-analyze-msg">A preparar e analisar a nota… veja o progresso abaixo.</p>
          </div>
        ) : null}
        <FaCloudUploadAlt className="purchase-ai-dropzone-graphic" aria-hidden />
        <p className="purchase-ai-dropzone-hint">Solte os ficheiros aqui (computador)</p>

        <div className="purchase-ai-pick-actions">
          <button
            type="button"
            className="btn btn-primary purchase-ai-pick-btn"
            disabled={disabled || analyzing || atLimit}
            onClick={() => cameraInputRef.current?.click()}
          >
            <span className="purchase-ai-pick-btn-inner">
              <FaCamera className="purchase-ai-pick-btn-icon" aria-hidden />
              <span className="purchase-ai-pick-btn-text">Tirar foto</span>
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary purchase-ai-pick-btn"
            disabled={disabled || analyzing || atLimit}
            onClick={() => galleryInputRef.current?.click()}
          >
            <span className="purchase-ai-pick-btn-inner">
              <FaFileAlt className="purchase-ai-pick-btn-icon" aria-hidden />
              <span className="purchase-ai-pick-btn-text">Galeria e ficheiros</span>
            </span>
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          className="visually-hidden"
          accept="image/*"
          capture="environment"
          onChange={onCameraChange}
          disabled={disabled || analyzing || atLimit}
        />
        <input
          ref={galleryInputRef}
          type="file"
          className="visually-hidden"
          accept={ACCEPT}
          multiple
          onChange={onGalleryChange}
          disabled={disabled || analyzing || atLimit}
        />

        <p className="purchase-ai-dropzone-meta">
          No telemóvel, use <strong>Tirar foto</strong> para cada página; as imagens ficam na lista até analisar.
          Máximo {MAX_RECEIPT_FILES} ficheiros (JPG, PNG ou PDF).
        </p>
      </div>

      {receipts.length > 0 ? (
        <div className="purchase-ai-receipt-queue" role="status" aria-live="polite">
          <div className="purchase-ai-receipt-queue-head">
            <span>
              {receipts.length} foto(s)/ficheiro(s) na fila
              {atLimit ? " (limite atingido)" : ""}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm purchase-ai-clear-queue"
              disabled={disabled || analyzing}
              onClick={() => onClearFiles?.()}
            >
              <FaTrash aria-hidden style={{ marginRight: "0.25rem" }} />
              Limpar tudo
            </button>
          </div>
          <ul className="purchase-ai-receipt-thumbs">
            {receipts.map((f, i) => (
              <li key={`${f.name}-${f.size}-${f.lastModified}-${i}`} className="purchase-ai-receipt-thumb">
                {previewUrls[i] ? (
                  <img src={previewUrls[i]} alt="" className="purchase-ai-receipt-thumb-img" />
                ) : (
                  <span className="purchase-ai-receipt-thumb-pdf" aria-hidden>
                    <FaFileAlt />
                  </span>
                )}
                <span className="purchase-ai-receipt-thumb-label" title={f.name}>
                  {f.name || `Foto ${i + 1}`}
                  <small>{formatFileSize(f.size)}</small>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon purchase-ai-receipt-thumb-remove"
                  title="Remover"
                  disabled={disabled || analyzing}
                  onClick={() => onRemoveFile?.(i)}
                >
                  <FaTimes aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="purchase-ai-analyze-action">
        <button
          type="button"
          className="btn btn-primary purchase-ai-analyze-btn"
          disabled={disabled || analyzing || !receipts.length}
          onClick={() => onAnalyze?.()}
        >
          <MdAutoAwesome aria-hidden style={{ marginRight: "0.35rem" }} />
          {receipts.length
            ? `Analisar com IA (${receipts.length} ${receipts.length === 1 ? "ficheiro" : "ficheiros"})`
            : "Analisar com IA"}
        </button>
        {receipts.length > 0 && !analyzing ? (
          <p className="purchase-ai-analyze-hint field-helper">
            Pode tirar mais fotos antes de analisar. Depois de analisar, novas fotos exigem tocar de novo neste botão.
          </p>
        ) : null}
      </div>
    </div>
  );
}
