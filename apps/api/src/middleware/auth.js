import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";

const issuer = config.jwtIssuer || `${config.supabaseUrl}/auth/v1`;
const jwksUrl = config.supabaseJwtJwksUrl || `${config.supabaseUrl}/auth/v1/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente." });
  }

  const token = header.replace("Bearer ", "");

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: config.jwtAudience
    });

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.app_metadata?.role ?? "manager",
      storeId: payload.user_metadata?.store_id ?? null
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito ao administrador." });
  }
  return next();
}

export function checkStoreScope(req, res, next) {
  const scopedStoreId = req.params.storeId || req.body.storeId || req.query.storeId;
  if (req.user?.role === "admin" || !scopedStoreId || req.user?.storeId === scopedStoreId) {
    return next();
  }
  return res.status(403).json({ message: "Sem permissão para outra loja." });
}

export function resolveStoreScope(req, _res, next) {
  if (req.user?.role !== "admin") {
    req.storeScopeId = req.user?.storeId;
    return next();
  }
  req.storeScopeId = req.params.storeId || req.body.storeId || req.query.storeId || null;
  return next();
}
