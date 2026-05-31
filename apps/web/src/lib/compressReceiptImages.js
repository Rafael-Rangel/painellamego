import imageCompression from "browser-image-compression";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** JPEG pequeno e já dentro da resolução-alvo: evita re-encodar e perder nitidez. */
const SKIP_REENCODE_JPEG_BELOW = 4 * 1024 * 1024;

/** PDF: limite alto no servidor; fotos não têm limite rígido para o utilizador. */
const MAX_PDF_BYTES = 12 * 1024 * 1024;

/** Perfil para análise IA: upload rápido mantendo leitura legível. */
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

/** Arquivo / publicação: mais nitidez para consulta futura da NF. */
export const RECEIPT_ARCHIVE_QUALITY_PRESET = {
  maxWidthOrHeight: 2560,
  initialQuality: 0.9,
  maxSizeMB: 6,
  useWebWorker: true,
  fileType: "image/jpeg",
  alwaysKeepResolution: false
};

const RECEIPT_ARCHIVE_GENTLE_PRESET = {
  maxWidthOrHeight: 2400,
  initialQuality: 0.86,
  maxSizeMB: 5,
  useWebWorker: true,
  fileType: "image/jpeg",
  alwaysKeepResolution: false
};

const ARCHIVE_GENTLE_PASS_IF_ABOVE = 8 * 1024 * 1024;

/** @type {Map<string, { ai?: File, archive?: File, aiPromise?: Promise<File>, archivePromise?: Promise<File> }>} */
const compressCache = new Map();

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Chave estável para cache (alinhada a receiptFileKey + tipo MIME). */
export function receiptCompressCacheKey(file) {
  return `${file?.name || ""}:${file?.size}:${file?.lastModified}:${file?.type || ""}`;
}

/** Regra pura de skip — útil para testes e leitura de dimensões assíncrona. */
export function canSkipJpegReencode({ size, width, height, maxSide, maxBytes = SKIP_REENCODE_JPEG_BELOW }) {
  if (!Number.isFinite(size) || size > maxBytes) return false;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  return Math.max(width, height) <= maxSide;
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

function blobToFile(blob, originalName) {
  if (blob instanceof File) return blob;
  return toOutputFile(blob, originalName);
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Não foi possível ler "${file.name}".`));
    };
    img.src = url;
  });
}

async function shouldSkipImageReencode(file, maxSide) {
  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
  if (!isJpeg) return false;
  if (file.size > SKIP_REENCODE_JPEG_BELOW) return false;
  try {
    const { width, height } = await readImageDimensions(file);
    return canSkipJpegReencode({ size: file.size, width, height, maxSide });
  } catch {
    return false;
  }
}

/**
 * Prepara fotos para upload: reduz peso na rede sem sacrificar leitura da NF.
 * O 2.º passe gentil reutiliza o output do 1.º (não reprocessa o original).
 */
async function compressOneReceiptFile(file, preset, gentlePreset, gentleAbove, maxSkipSide) {
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

  if (await shouldSkipImageReencode(file, maxSkipSide)) {
    return file;
  }

  let compressed = await imageCompression(file, preset);
  if (gentlePreset && compressed.size > gentleAbove) {
    const secondInput = blobToFile(compressed, file.name);
    const gentler = await imageCompression(secondInput, gentlePreset);
    if (gentler.size < compressed.size) compressed = gentler;
  }

  const smaller = compressed.size < file.size ? compressed : file;
  return toOutputFile(smaller, file.name);
}

function cacheEntry(key) {
  let entry = compressCache.get(key);
  if (!entry) {
    entry = {};
    compressCache.set(key, entry);
  }
  return entry;
}

async function getOrCompress(file, kind) {
  const key = receiptCompressCacheKey(file);
  const entry = cacheEntry(key);

  if (kind === "ai") {
    if (entry.ai) return entry.ai;
    if (!entry.aiPromise) {
      entry.aiPromise = compressOneReceiptFile(
        file,
        RECEIPT_AI_QUALITY_PRESET,
        RECEIPT_AI_GENTLE_PRESET,
        AI_GENTLE_PASS_IF_ABOVE,
        RECEIPT_AI_QUALITY_PRESET.maxWidthOrHeight
      )
        .then((result) => {
          entry.ai = result;
          delete entry.aiPromise;
          return result;
        })
        .catch((err) => {
          delete entry.aiPromise;
          throw err;
        });
    }
    return entry.aiPromise;
  }

  if (entry.archive) return entry.archive;
  if (!entry.archivePromise) {
    entry.archivePromise = compressOneReceiptFile(
      file,
      RECEIPT_ARCHIVE_QUALITY_PRESET,
      RECEIPT_ARCHIVE_GENTLE_PRESET,
      ARCHIVE_GENTLE_PASS_IF_ABOVE,
      RECEIPT_ARCHIVE_QUALITY_PRESET.maxWidthOrHeight
    )
      .then((result) => {
        entry.archive = result;
        delete entry.archivePromise;
        return result;
      })
      .catch((err) => {
        delete entry.archivePromise;
        throw err;
      });
  }
  return entry.archivePromise;
}

/** Pré-comprime em background ao adicionar ficheiros (IA + arquivo). */
export function warmReceiptCompressCache(files) {
  for (const file of Array.from(files || []).filter(Boolean)) {
    if (file.type === "application/pdf") continue;
    void getOrCompress(file, "ai").catch(() => {});
    void getOrCompress(file, "archive").catch(() => {});
  }
}

async function compressMany(files, kind, hooks = {}) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return [];

  return Promise.all(
    list.map(async (file, i) => {
      hooks.onFileStart?.({ index: i, total: list.length, name: file.name });
      if (file.type === "application/pdf") return file;
      return getOrCompress(file, kind);
    })
  );
}

/** Arquivo / publicação (2560 px, maior nitidez). */
export async function compressReceiptFiles(files, hooks = {}) {
  return compressMany(files, "archive", hooks);
}

/** Envio final (POST /purchases) e rascunhos no servidor. */
export async function compressReceiptFilesForSubmit(files, hooks = {}) {
  return compressMany(files, "archive", hooks);
}

/** Análise IA (1920 px, upload mais leve). */
export async function compressReceiptFilesForAi(files, hooks = {}) {
  return compressMany(files, "ai", hooks);
}
