# App Interno de Compras - Rede Lamego

Plataforma interna para registro e inteligência de compras entre lojas, com comparação de preços, ranking de eficiência e alertas de economia.

## Documentacao completa
- Visao tecnica e funcional atual: `docs/PROJETO-STATUS-ATUAL.md`

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Banco: Supabase (PostgreSQL + RLS + Storage)

## Estrutura
- `apps/web`: aplicação React
- `apps/api`: API Express
- `packages/shared`: schemas compartilhados
- `infra/supabase`: migrations e seeds SQL

## Configuração
1. Copie `.env.example` para `.env`.
2. Preencha variáveis Supabase (`URL`, `publishable key`, `service role key`, `db password`).
3. Instale dependências:
   - `npm install`

## Rodar local
- API + frontend: `npm run dev`
- Somente API: `npm run dev:api`
- Somente frontend: `npm run dev:web`

## Banco de dados
- Migrations estão em `infra/supabase/migrations`.
- Com Supabase CLI:
  - `supabase start`
  - `npm run db:reset`
  - `npm run db:push`

## Endpoints principais
- `POST /auth/login`
- `GET/POST /catalog/products`
- `GET/POST /catalog/stores`
- `GET/POST /catalog/suppliers`
- `POST /purchases`
- `GET /purchases/store/:storeId`
- `GET /comparisons/products/:id`
- `GET /dashboards/stores`
- `GET /dashboards/products`
- `GET /dashboards/period?months=6`
- `GET /alerts/me`
