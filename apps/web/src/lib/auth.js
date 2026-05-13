export function parseJwt(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function getUserFromToken(token) {
  const payload = parseJwt(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.app_metadata?.role ?? "manager",
    storeId: payload.user_metadata?.store_id ?? null
  };
}
