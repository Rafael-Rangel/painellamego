import multer from "multer";

function messageFromUnknown(err) {
  if (!err) return "Erro interno do servidor.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "Erro interno do servidor.";
  if (typeof err.message === "string" && err.message) return err.message;
  return "Erro interno do servidor.";
}

/** Respostas JSON para erros do Express 5 / multer / Supabase (evita HTML 500 opaco). */
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: "Arquivo da nota muito grande (máx. 15 MB por ficheiro).",
      LIMIT_FILE_COUNT: "Número máximo de ficheiros da nota excedido.",
      LIMIT_UNEXPECTED_FILE: "Campo de upload inválido. Use apenas os ficheiros da nota."
    };
    const message = map[err.code] || `Erro no upload: ${err.code}`;
    console.error("[api] multer", { code: err.code, path: req.path, userId: req.user?.id });
    return res.status(400).json({ message });
  }

  const message = messageFromUnknown(err);
  console.error("[api] erro não tratado", {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    message
  });
  return res.status(500).json({ message });
}
