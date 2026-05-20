# Supabase : banco e migrations

> A pasta canônica passou a ser `supabase/` na raiz do repositório (padrão Supabase CLI).
> As migrations vivem em `supabase/migrations/*.sql`.
> O `config.toml` da CLI fica em `supabase/config.toml`.

## Pré-requisitos

- Node.js (já temos no projeto)
- Senha do banco do projeto Supabase em `SUPABASE_DB_PASSWORD` no `.env` da raiz
  - Achar em: Supabase Dashboard → Project Settings → Database → "Database password"

A CLI do Supabase já vem como dev dependency. Use sempre `npx`:

```bash
npx supabase --version
```

## Fluxo completo de migração para um Supabase novo

1. **Configurar `.env` da raiz** com:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PROJECT_REF`
   - `SUPABASE_DB_PASSWORD`

2. **Linkar projeto**:

   ```bash
   npm run db:link
   # ou diretamente:
   npx supabase link --project-ref <PROJECT_REF>
   ```

   A CLI vai pedir a senha do banco. Cole a `SUPABASE_DB_PASSWORD`.

3. **Aplicar todas as migrations** (schema + seeds + RLS):

   ```bash
   npm run db:push
   # equivalente: npx supabase db push --include-all
   ```

4. **Bootstrap do Auth** (admin + 3 gerentes prontos para login):

   ```bash
   npm run supabase:bootstrap
   ```

   Esse script cria/atualiza usuários no Supabase Auth com `email_confirm=true`,
   `app_metadata.role` correto e `user_metadata.store_id` para os gerentes,
   além de `manager_store_links` para cada loja.

## Credenciais default geradas pelo bootstrap

| Papel    | E-mail                              | Senha             |
| -------- | ----------------------------------- | ----------------- |
| Admin    | `admin@lamego.local`              | `Adm!nLamego2026#`    |
| Gerente  | `gerente.centro@lamego.com.br`      | `Gerente@2026!`   |
| Gerente  | `gerente.sul@lamego.com.br`         | `Gerente@2026!`   |
| Gerente  | `gerente.norte@lamego.com.br`       | `Gerente@2026!`   |

> **Importante**: troque essas senhas pelo Dashboard do Supabase em produção.

## Recuperação de senha

A página `/forgot-password` chama `supabase.auth.resetPasswordForEmail`,
que envia um link redirecionando para `/reset-password`. O e-mail real depende
do **SMTP** configurado no projeto Supabase:

- Sem SMTP customizado: Supabase usa o serviço interno (limite baixo, ok p/ testes).
- Em produção: configure SMTP em **Project Settings → Auth → Email** no Dashboard.

## Ordem das migrations

1. `001_init_schema.sql`
2. `002_indexes_constraints.sql`
3. `003_rls_policies.sql`
4. `004_views_metrics_alerts.sql`
5. `005_seed_products_categories.sql`
6. `006_categories_and_product_hardening.sql`
7. `007_rls_hardening_and_views.sql`
8. `008_mock_data_dev.sql`
9. `009_manager_store_links_and_onboarding.sql`
10. `010_seed_manager_dashboard_data.sql`
11. `011_purchase_items_line_type.sql`
12. `012_store_number_normalize.sql`

## Reset local (Docker)

```bash
npx supabase start
npx supabase db reset   # aplica TODAS as migrations no Postgres local
```
