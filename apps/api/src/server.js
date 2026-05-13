import app from "./app.js";
import { config, ensureRequiredConfig } from "./config.js";

ensureRequiredConfig();

const server = app.listen(config.port, config.host, () => {
  console.log(`[api] rodando em http://${config.host}:${config.port} (env=${config.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`[api] recebendo ${signal}, encerrando...`);
  server.close((err) => {
    if (err) {
      console.error("[api] erro ao encerrar:", err);
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
