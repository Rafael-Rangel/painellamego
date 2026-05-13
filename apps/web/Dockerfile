FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install --workspace @lamego/web --workspace @lamego/shared --include-workspace-root

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY logo.jpg ./logo.jpg

# Garante que public/logo.jpg exista no build (para favicon e header)
RUN cp -f /app/logo.jpg /app/apps/web/public/logo.jpg

# Vite embute import.meta.env no build; variáveis de runtime do container não entram no bundle.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

RUN npm --workspace @lamego/web run build

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
