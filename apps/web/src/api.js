import axios from "axios";

/** Em produção o nginx do container web faz proxy de /api/ → API; em dev a API costuma estar em localhost. */
function resolveApiBaseURL() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "http://localhost:3333";
  return "/api";
}

export const api = axios.create({
  baseURL: resolveApiBaseURL()
});

export function withAuth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}
