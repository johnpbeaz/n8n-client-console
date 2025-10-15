# Catalyst Backend

TypeScript/Express API that authenticates users, proxies workflow triggers to n8n, and serves client/admin data to the React dashboard.

## Stack

- Node.js 20 (ESM)
- Express 4 with Zod validation
- Prisma ORM + PostgreSQL
- JWT authentication with BCrypt password hashing

## Getting Started (Local Node Runtime)

> Requires Node.js **>= 18** and npm 9+

```bash
cp .env.development .env
npm install
npx prisma migrate dev --name init
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me npx prisma db seed
npm run dev
```

The API runs on `http://localhost:4000`. Default seed users:

- Admin — `admin@example.com / change-me`

## Docker (recommended for parity)

From the repo root:

```bash
docker compose -f ai-dashboard/docker-compose.yml up --build backend postgres
```

The backend listens on port `4000`, and PostgreSQL is mapped to `5434` on the host.

To load demo data inside the container:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend bash -lc 'SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change-me npx prisma db seed'
```

## Key Environment Variables

- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – secret used to sign access tokens
- `N8N_BASE_URL` / `N8N_API_KEY` – optional; enables workflow sync from your n8n instance (`N8N_BASE_URL` should include `/api/v1/`)
- `N8N_WEBHOOK_BASE_URL` – optional override for the base URL used when generating webhook triggers (defaults to `N8N_BASE_URL` with `/api/v1/` removed)
- `Client.n8nProjectId` controls which n8n project is synced for that client (use the `projectId` returned in each workflow's `shared` array)
- `CORS_ORIGIN` – comma-separated list of allowed origins (e.g. `http://localhost:5175`)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` – optional; provide these when running `prisma db seed` to create an initial admin account
- `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_FROM_EMAIL` – optional; configure these to send client welcome emails via Mailgun (default base URL is `https://api.mailgun.net`)
- `APP_BASE_URL` – the public URL for the dashboard frontend (used to build password setup links shared with clients)

See `.env.example` for full list. The included `.env.development` provides safe defaults for local Docker runs.

### Client onboarding email

When an admin adds client emails in the dashboard, the backend provisions individual login users and issues password setup tokens. If Mailgun is configured, each contact receives an email inviting them to create their password. When email delivery is unavailable, the API responds with shareable setup links so the admin can distribute them manually.
