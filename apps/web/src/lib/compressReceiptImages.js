import imageCompression from "browser-image-compression";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** JPEG já leve: evita re-encodar e perder nitidez de texto na NF. */
const SKIP_REENCODE_JPEG_BELOW = 4 * 1024 * 1024;

/** PDF: limite alto no servidor; fotos não têm limite rígido para o utilizador. */
const MAX_PDF_BYTES = 12 * 1024 * 1024;

/** Perfil principal: nitidez para OCR/IA (nota fiscal). */
const RECEIPT_QUALITY_PRESET = {
  maxWidthOrHeight: 2560,
  initialQuality: 0.9,
  /** Teto suave para o algoritmo  ·  não força 1–2 MB como alvo. */
  maxSizeMB: 6,
  useWebWorker: true,
  fileType: "image/jpeg",
  alwaysKeepResolution: false
};

/** Perfil para análise IA: upload mais rápido mantendo leitura legível. */
export const RECEIPT_AI_QUALITY_PRESET = {
  maxWidthOrHeight: 1920,
  initialQuality: 0.84,
  maxSizeMB: 2.5,
  useWebWorker: true,
  fileType: "image/jpeg",
  alwaysKeepResolution: false
};

const RECEIPT_AI_GENTLE_PRESET = {
  maxWidthOrHeight: 1800,
  initialQuality: 0.8,
  maxSizeMB: 2,
  useWebWorker: true,
  fileType: "image/jpeg",
  alwaysKeepResolution: false
};

const AI_GENTLE_PASS_IF_ABOVE = 5 * 1024 * 1024;

/** Só se a foto continuar muito pesada após o 1.º passe (ex.: 40 MB da câmera). */
const RECEIPT_GENTLE_PRESET = {
  maxWidthOrHeight: 2400,
  initialQuality: 0.86,
  maxSizeMB: 5,
  useWebWorker: true,
  fileType: "image/jpeg",
  alwaysKeepResolution: false
};

/** Acima disto, 2.º passe gentil; nunca bloqueamos o envio. */
const GENTLE_PASS_IF_ABOVE = 8 * 1024 * 1024;

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function jpegName(originalName) {
  const base = String(originalName || "nota").replace(/\.[^.]+$/i, "");
  return `${base || "nota"}.jpg`;
}

function toOutputFile(blob, originalName) {
  return new File([blob], jpegName(originalName), {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}

/**
 * Prepara fotos da câmera para upload: reduz peso na rede sem sacrificar leitura da IA.
 * Não há limite rígido em MB para o gerente  ·  a app adapta-se ao ficheiro.
 */
async function compressOneReceiptFile(file, preset, gentlePreset, gentleAbove) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(
        `O PDF "${file.name}" é muito grande para enviar (${formatFileSize(file.size)}). Tente fotografar a nota ou use um PDF mais curto.`
      );
    }
    return file;
  }

  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error(`Formato não suportado em "${file.name}". Use foto (JPG/PNG) ou PDF.`);
  }

  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
  if (isJpeg && file.size <= SKIP_REENCODE_JPEG_BELOW) {
    return file;
  }

  let compressed = await imageCompression(file, preset);
  if (gentlePreset && compressed.size > gentleAbove) {
    const gentler = await imageCompression(file, gentlePreset);
    if (gentler.size < compressed.size) compressed = gentler;
  }

  const smaller = compressed.size < file.size ? compressed : file;
  return toOutputFile(smaller, file.name);
}

export async function compressReceiptFiles(files, hooks = {}) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return [];

  return Promise.all(
    list.map(async (file, i) => {
      hooks.onFileStart?.({ index: i, total: list.length, name: file.name });
      return compressOneReceiptFile(file, RECEIPT_QUALITY_PRESET, RECEIPT_GENTLE_PRESET, GENTLE_PASS_IF_ABOVE);
    })
  );
}

/** Compressão mais leve para o fluxo «Analisar com IA» (menos upload, OCR ainda legível). */
export async function compressReceiptFilesForAi(files, hooks = {}) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return [];

  return Promise.all(
    list.map(async (file, i) => {
      hooks.onFileStart?.({ index: i, total: list.length, name: file.name });
      return compressOneReceiptFile(
        file,
        RECEIPT_AI_QUALITY_PRESET,
        RECEIPT_AI_GENTLE_PRESET,
        AI_GENTLE_PASS_IF_ABOVE
      );
    })
  );
}
