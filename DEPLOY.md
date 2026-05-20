# Deploy de produção - painellamego.com.br

Stack final em produção:

- **Caddy** na borda (TLS Let's Encrypt automático)
- **Web** (build estático do Vite servido por Nginx)
- **API** (Node 22 + Express, em container)
- **Backup** (cron + pg_dump semanal contra o Postgres do Supabase)

Tudo em `docker compose`. O domínio único é `https://painellamego.com.br` e a API fica em `/api/*`.

### Produção atual (VPS com nginx-proxy / outro projeto na mesma máquina)

Quando **80/443** já são usados por **nginx-proxy** + **acme-companion** (ex.: stack em `/opt/jada`), o Lamego **não** sobe o Caddy próprio. Use o overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml up -d --build
```

O container `web` entra na rede externa `jada_webproxy`; TLS e roteamento por host ficam no proxy existente. **Não** é necessário editar o outro projeto.

**Atualizar só o Lamego** (recomendado):

```bash
sudo bash /opt/lamego/scripts/deploy-vps.sh
```

Variáveis opcionais: `LAMEGO_DIR` (padrão `/opt/lamego`), `DEPLOY_BRANCH` (padrão `main`).

## 1. DNS

No painel do registrador, crie:

| Tipo | Nome                | Valor             |
| ---- | ------------------- | ----------------- |
| A    | `painellamego.com.br` | IP da VPS         |
| A    | `www.painellamego.com.br` | IP da VPS (opcional, redireciona) |

Aguarde a propagação (`dig painellamego.com.br +short` deve retornar o IP).

## 2. VPS com outro projeto Docker (sem interferência)

Na mesma VPS dá para rodar o Lamego **isolado** do outro stack:

- diretório próprio, por exemplo `/opt/lamego`;
- projeto Compose `lamego` (rede, volumes e containers separados);
- **não** alterar o outro projeto.

**Portas 80/443 livres** : suba o stack padrão (Caddy com TLS automático):

```bash
docker compose up -d --build
```

**80/443 já usados** (ex.: nginx de outro projeto) : use o modo coexistência:

```bash
docker compose -f docker-compose.yml -f docker-compose.coexist.yml up -d --build
```

Isso publica só `web` em `127.0.0.1:18080` e `api` em `127.0.0.1:13333` e **não** sobe o Caddy deste projeto. O TLS de `painellamego.com.br` fica no proxy que já escuta 80/443; modelo em `ops/deploy/painellamego.nginx.conf.example` (arquivo **novo**, sem editar o outro projeto).

## 3. Preparar a VPS (Ubuntu 22.04+)

```bash
# Docker + plugin compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker  # ou re-login

# Firewall mínimo
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## 4. Clonar e configurar

```bash
git clone <url-do-repo> /opt/lamego
cd /opt/lamego

cp .env.production.example .env.production
nano .env.production   # preencher SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DB_PASSWORD
```

> O `.env.production` é gitignored - **nunca** commit segredos.

### Servidor já existente (rsync) sem pasta `.git`

Se `/opt/lamego` foi copiado sem Git, ligue ao repositório **sem apagar** `.env.production` (arquivo local, fora do Git):

```bash
cd /opt/lamego
git init
git remote add origin https://github.com/Rafael-Rangel/painellamego.git
git fetch origin main
git checkout -B main origin/main
chmod +x scripts/deploy-vps.sh
cp -f .env.production .env   # se ainda não existir .env
```

Se o `checkout` reclamar de arquivos locais que conflitam com o repo, faça backup do que for preciso e alinhe manualmente, ou clone em um diretório novo, copie só `.env.production` e troque o nome das pastas.

## 5. Subir os containers

**Com nginx-proxy na VPS (produção típica atual):**

```bash
cd /opt/lamego
cp -f .env.production .env   # necessário para o serviço backup interpolar SUPABASE_DB_PASSWORD
docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml build
docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml up -d
```

Acompanhar certificado: `docker logs jada-acme-companion --tail 50` (Let's Encrypt para `painellamego.com.br`).

**Com Caddy na borda (VPS dedicada ou portas 80/443 livres):**

```bash
docker compose pull
docker compose build
docker compose up -d

docker compose logs -f caddy
```

A primeira inicialização do Caddy leva alguns segundos para emitir o certificado Let's Encrypt; depois disso o site sobe em `https://painellamego.com.br`.

## 6. Validar

```bash
curl -I https://painellamego.com.br
curl https://painellamego.com.br/api/health
# {"ok":true,"env":"production"}
```

Logue na UI com o admin (`admin@lamego.local` / `Adm!nLamego2026#`) e troque a senha pelo Dashboard do Supabase.

## 7. Atualizar o app

**Com nginx-proxy (recomendado na VPS atual):**

```bash
sudo bash /opt/lamego/scripts/deploy-vps.sh
```

Equivalente manual:

```bash
cd /opt/lamego
cp -f .env.production .env
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml build
docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml up -d
```

**Somente stack com Caddy:**

```bash
cd /opt/lamego
git pull
docker compose build
docker compose up -d
```

`unless-stopped` faz cada container voltar sozinho após reboot ou crash.

### Automação (cron na VPS)

Exemplo a cada 15 minutos (ajuste o caminho e o usuário):

```cron
*/15 * * * * root cd /opt/lamego && git fetch origin main && git pull --ff-only origin main && /opt/lamego/scripts/deploy-vps.sh >> /var/log/lamego-deploy.log 2>&1
```

Prefira deploy sob demanda ou webhook protegido em vez de pull agressivo em produção.

## 8. Backups

O serviço `backup` roda dentro do compose com cron `0 3 * * 0` (todo domingo, 3h, fuso `America/Sao_Paulo`). Os arquivos ficam em `./ops/backup/backups/lamego-YYYY-MM-DD-HHMM.sql.gz`, com retenção de 28 dias por padrão.

### Forçar 1 backup agora

```bash
cd /opt/lamego
docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml exec backup /usr/local/bin/backup.sh
ls -lh ops/backup/backups/
```

(Em ambiente só com Caddy, use `docker compose exec backup ...`.)

### Restaurar um backup

```bash
gunzip -c ops/backup/backups/lamego-YYYY-MM-DD-HHMM.sql.gz \
  | psql "postgresql://postgres:<SENHA>@db.hfxqvitixkrqjggkbbej.supabase.co:5432/postgres"
```

> Para PITR (point-in-time recovery) profissional, ative o plano pago do Supabase no Dashboard. Esse backup local é redundância adicional.

## 9. Monitoramento

- `docker compose -f docker-compose.yml -f docker-compose.nginxproxy.yml ps` (produção atual) ou `docker compose ps` (Caddy).
- Logs: `docker compose ... logs -f api` ou `web`; proxy/TLS: `docker logs jada-nginx-proxy` / `jada-acme-companion`.
- Healthcheck público: `https://painellamego.com.br/api/health`.
- Recomendação: cadastrar **uptime check externo** (UptimeRobot, Better Stack, etc.) apontando para `https://painellamego.com.br/api/health` com alerta por e-mail.

## 10. Migrations futuras

Quando criar uma nova migration em `supabase/migrations/`:

```bash
# localmente, com SUPABASE_DB_PASSWORD no .env da raiz
npm run db:push
```

Não é necessário restartar containers para schema changes.

## 11. Auth no Supabase (links sem localhost, gerentes com senha)

Os fluxos de Auth usam URLs do projeto Supabase. O cadastro de gerente no painel usa **senha definida pelo admin** (`createUser`). Recuperação de senha usa o endpoint GoTrue `/auth/v1/recover` (via API Lamego ou Supabase) e precisa de **SMTP/e-mail** ativo no Supabase para entrega fiável; o e-mail incorporado do plano gratuito tem **poucos envios por hora** ([rate limits](https://supabase.com/docs/guides/auth/rate-limits)).

1. No [Dashboard do Supabase](https://supabase.com/dashboard) do projeto: **Authentication → URL Configuration**.
2. **Site URL:** `https://painellamego.com.br` (sem barra final desnecessária; o domínio público do painel).
3. **Redirect URLs:** inclua pelo menos:
   - `https://painellamego.com.br/reset-password` (link de «Esqueci minha senha» e redefinição)
   - `https://painellamego.com.br/login`
   - Opcional: `https://painellamego.com.br/**` se o painel permitir wildcard.

4. **Esqueci minha senha (web):** a página chama `POST /auth/forgot-password` na API (rota pública), com `redirect_to` derivado de **`APP_ORIGIN`** no servidor (evita link com `localhost`). Limite na API Lamego: **5 pedidos / 15 min por IP** (além dos limites do Supabase).

**`APP_ORIGIN`** em `.env.production` / `docker-compose` (serviço `api`) deve ser `https://painellamego.com.br`.

Documentação: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

### Leitura de nota com IA (OpenRouter) : “carrega para sempre”

- **Modelo recomendado em produção:** `OPENROUTER_MODEL=google/gemini-2.5-pro` (visão + JSON). Fallback: `OPENROUTER_FALLBACK_MODEL=google/gemini-2.5-flash`.
- **Regressão local (amostras WhatsApp):** `node scripts/test-receipt-batch.mjs --only golden` (requer `OPENROUTER_API_KEY`; imagens em `scripts/fixtures/receipt-samples/`).
- **Causas frequentes:** pedido ao OpenRouter **sem timeout** (ficava pendente até o proxy cortar); **nginx** entre `web` e `api` com `proxy_read_timeout` curto (504); PDF/imagem muito grande; vários ficheiros em sequência; rede lenta.
- **No código:** cada chamada HTTP ao OpenRouter tem timeout configurável (`OPENROUTER_FETCH_TIMEOUT_MS`, predefinido 120 s); o nginx interno do container `web` usa **300 s** para `/api/`; o browser usa **300 s** neste pedido.
- **Na VPS:** `docker logs lamego-api-1 --tail 300` (erros OpenRouter, timeout, chave). Se usares **nginx-proxy** à frente (ex.: `jada-nginx-proxy`), pode ser preciso aumentar o timeout do *upstream* para o container Lamego (além do nginx dentro do `web`).
- **413 no `jada-nginx-proxy`:** o proxy recusava corpos grandes (ex.: ~4,5 MB) com *“client intended to send too large body”* : o pedido **não chegava à API**; no telemóvel parecia carregar muito tempo e falhar. O `docker-compose.nginxproxy.yml` define `CLIENT_MAX_BODY_SIZE: 25m` no serviço `web`; após `git pull`, recria o container `web` (`compose ... up -d --build web`).

## 12. Tarefas pendentes (sem urgência)

- Configurar **SMTP** no Supabase Auth (Project Settings > Auth > Email) para que o "Esqueci minha senha" entregue e-mails reais.
- Trocar as senhas seed (`Adm!nLamego2026#`, `Gerente@2026!`) pelo Dashboard do Supabase em produção.
