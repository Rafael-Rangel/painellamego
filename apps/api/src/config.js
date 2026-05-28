import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config({ path: new URL("../../../.env", import.meta.url) });

function parseOrigins(raw) {
  if (!raw) return ["http://localhost:5173"];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

const appOriginRaw = process.env.APP_ORIGIN ?? "http://localhost:5173";
const primaryAppOrigin = parseOrigins(appOriginRaw)[0] ?? "http://localhost:5173";

/** URL após clicar no link do e-mail de convite (deve estar na allowlist do Supabase Auth). */
const authInviteRedirectUrl = `${primaryAppOrigin.replace(/\/$/, "")}/reset-password`;

export const config = {
  port: Number(process.env.PORT ?? 3333),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseJwtJwksUrl: process.env.SUPABASE_JWKS_URL ?? "",
  jwtAudience: process.env.JWT_AUDIENCE ?? "authenticated",
  jwtIssuer: process.env.JWT_ISSUER ?? "",
  appOrigin: appOriginRaw,
  appOrigins: parseOrigins(appOriginRaw),
  authInviteRedirectUrl,
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  /** Leitura de NF — principal: OpenAI Platform (gpt-5.5). */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.5",
  openaiFetchTimeoutMs: Math.min(
    300_000,
    Math.max(15_000, Number(process.env.OPENAI_FETCH_TIMEOUT_MS ?? 120_000) || 120_000)
  ),
  openaiMaxTokens: Math.min(
    8192,
    Math.max(2048, Number(process.env.OPENAI_MAX_TOKENS ?? 4096) || 4096)
  ),
  /** Fallback OpenRouter (ex.: google/gemini-3.1-pro-preview). */
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterFallbackModel: process.env.OPENROUTER_FALLBACK_MODEL ?? "google/gemini-3.1-pro-preview",
  openRouterHttpReferer: process.env.OPENROUTER_HTTP_REFERER ?? process.env.APP_ORIGIN ?? "",
  openRouterAppTitle: process.env.OPENROUTER_APP_TITLE ?? "Lamego Compras",
  openRouterFetchTimeoutMs: Math.min(
    300_000,
    Math.max(15_000, Number(process.env.OPENROUTER_FETCH_TIMEOUT_MS ?? 120_000) || 120_000)
  ),
  openRouterMaxTokens: Math.min(
    8192,
    Math.max(2048, Number(process.env.OPENROUTER_MAX_TOKENS ?? 4096) || 4096)
  ),
  /** Máximo de ficheiros analisados em paralelo por pedido receipt-ai-parse. */
  receiptAiParseConcurrency: Math.min(
    4,
    Math.max(1, Number(process.env.RECEIPT_AI_PARSE_CONCURRENCY ?? 2) || 2)
  )
};

export function ensureRequiredConfig() {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variável obrigatória ausente: ${key}`);
    }
  }
}
