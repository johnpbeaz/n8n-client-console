# Catalyst

A full-stack control panel for reselling n8n automations to client organizations. Catalyst gives each client a branded dashboard where they can trigger the workflows you grant them, while your team manages access, invitations, and n8n project sync from an admin view.

## Features

- **Client dashboard** – authenticated users see the workflows assigned to them, including webhook URL details and latest run time.
- **Multi-contact logins** – every email added to a client gets its own account. Each contact receives a password-setup link (or a manual link if email delivery is disabled).
- **Admin control centre** – manage clients, assign n8n workflows/projects, archive or delete clients, reset passwords, and trigger syncs from your n8n instance.
- **Workflow execution proxy** – the backend securely triggers n8n webhooks on behalf of your users and records run metadata.
- **Deployment ready** – Docker Compose stack, Prisma migrations, environment-driven configuration, and a password token system for fully managed invitations.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18 + TypeScript, Vite, React Router, TanStack Query, Tailwind CSS |
| Backend  | Node.js 20, Express 4, Prisma, PostgreSQL, JSON Web Tokens, Mailgun (optional) |
| Tooling  | Docker Compose, ESLint, Prettier |

## Repository Structure

```
├── backend/              # Express API + Prisma ORM
│   ├── prisma/           # Schema & migrations
│   └── src/              # Controllers, services, routes
├── frontend/             # Vite-powered React SPA
│   └── src/              # Pages, components, API client, auth context
├── docker-compose.yml    # Full stack runtime (Postgres + API + Frontend)
└── README.md             # Project overview (this document)
```

## Getting Started

### Prerequisites

- Node.js **18.17+** (Node 20 recommended)
- npm **9+**
- Docker Desktop (optional but recommended for parity)
- An n8n instance with an API key and base URL (`https://your-host/api/v1/`)
- (Optional) Mailgun account for automated invitation emails

### Clone the Repository

```bash
git clone https://github.com/johnpbeaz/n8n-client-console.git
cd n8n-client-console
```

> The working tree contains three long-lived branches: `develop`, `staging`, and `production`. Day-to-day work happens in `develop`.

## Running with Docker Compose

The quickest way to see the entire stack is via Docker Compose. From the project root:

```bash
docker compose up --build
```

Services exposed on the host:

| Service   | URL                     |
|-----------|-------------------------|
| Frontend  | http://localhost:5175   |
| Backend   | http://localhost:4000   |
| Postgres  | localhost:5434          |

Docker uses the environment file `backend/.env.development` by default. Update it before running the stack (see [Environment Variables](#environment-variables)).

To stop the stack: `docker compose down`. Data is stored in the `postgres_data` named volume.

## Local Development (without Docker)

### Backend API

```bash
cd backend
cp .env.development .env        # customise values for your machine
npm install
npx prisma migrate deploy       # or prisma migrate dev for iterative work
npm run dev                     # runs ts-node-dev with auto reload
```

The API listens on `http://localhost:4000`.

To seed an initial admin account:

```bash
SEED_ADMIN_EMAIL=admin@example.com \
SEED_ADMIN_PASSWORD=change-me \
SEED_ADMIN_NAME="Catalyst Admin" \
npx prisma db seed
```

### Frontend SPA

```bash
cd frontend
cp .env.example .env                  # optional – defaults to http://localhost:4000/api
npm install
npm run dev                           # launches Vite on http://localhost:5173
```

During local development you can run the backend with Node and the frontend with Vite concurrently. Ensure CORS origins are configured appropriately in the backend `.env`.

## Environment Variables

### Backend (`backend/.env`)

Key values used by the API:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL`        | ✅ | PostgreSQL connection string |
| `JWT_SECRET`          | ✅ | Secret used to sign access tokens |
| `JWT_EXPIRY`          | ❌ | JWT lifetime (default `12h`) |
| `PORT`                | ❌ | API port (default `4000`) |
| `CORS_ORIGIN`         | ❌ | Comma-separated list of allowed origins |
| `N8N_BASE_URL`        | ✅ | n8n REST base URL including `/api/v1/` |
| `N8N_API_KEY`         | ✅ | n8n API key for listing projects/workflows |
| `N8N_WEBHOOK_BASE_URL`| ❌ | Override for webhook URLs (defaults to `N8N_BASE_URL` without `/api/v1`) |
| `APP_BASE_URL`        | ✅ | Public URL of this dashboard (used in invitation links) |
| `MAILGUN_API_KEY`     | ❌ | Enable Mailgun email delivery |
| `MAILGUN_DOMAIN`      | ❌ | Mailgun domain (e.g. `mg.example.com`) |
| `MAILGUN_FROM_EMAIL`  | ❌ | From address (e.g. `Catalyst <noreply@example.com>`) |
| `MAILGUN_BASE_URL`    | ❌ | Mailgun API base (defaults to `https://api.mailgun.net`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | ❌ | Base URL for API requests (default `http://localhost:4000/api`)

## Database & Prisma

- Run `npx prisma migrate dev` while developing schema changes. Migrations live in `backend/prisma/migrations/`.
- Generate types with `npm run prisma:generate` when you update the schema.
- `PasswordToken` and `ClientEmail` are core tables supporting the invitation flow.

## Admin Operations & Workflow Sync

1. **Add a client** from the admin page, supplying one or more email addresses. Each email becomes an independent login.
2. **Assign workflows** by syncing from n8n or selecting individual workflows; the backend stores webhook metadata for proxying.
3. **Invitations**: if Mailgun is configured, contacts receive an email with a short-lived password setup link. Otherwise, the API response provides manual share links.
4. **Password resets** trigger the same token flow.
5. **Archiving/deleting** clients removes access without touching n8n workflows.

## Password Setup Flow

- Invites and resets create a hashed record in the `PasswordToken` table.
- The frontend exposes `/password/setup?token=...` where users create their password.
- Tokens expire after 72 hours (configurable in `password-token.service.ts`).
- The API automatically invalidates used or expired tokens.

## Useful npm Scripts

### Backend

| Script | Description |
|--------|-------------|
| `npm run dev`           | Start Express in watch mode (ts-node-dev) |
| `npm run build`         | Compile TypeScript to `dist/` |
| `npm run start`         | Run compiled app (production) |
| `npm run prisma:migrate`| Shortcut for `prisma migrate dev` |
| `npm run prisma:generate`| Regenerate Prisma client |
| `npm run prisma:seed`   | Execute the seed script |

### Frontend

| Script | Description |
|--------|-------------|
| `npm run dev`     | Start Vite dev server |
| `npm run build`   | Create production bundle in `dist/` |
| `npm run preview` | Preview the production build |

## Branch Strategy

- `develop` – active development, feature branches merge here first.
- `staging` – QA-ready snapshots taken from `develop`.
- `production` – code that’s deployed to live environments.

Use pull requests to promote across branches once CI/CD is in place.

## Roadmap / Next Steps

- Add automated testing (Vitest + React Testing Library, supertest for API).
- Implement workflow run history views and real-time status updates.
- Extend invitation emails with branding and optional SendGrid/Ses support.
- Integrate CI for linting, type checks, and automated deploys.

## License

This project is proprietary to John Beasley. Contact `johnpbeaz@gmail.com` for usage inquiries.
