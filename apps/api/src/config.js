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
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterModel: process.env.OPENROUTER_MODEL ?? "google/gemini-1.5-pro"
};

export function ensureRequiredConfig() {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variável obrigatória ausente: ${key}`);
    }
  }
}
