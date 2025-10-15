# Catalyst Frontend (React + Vite)

Client console that authenticates against the Node/Express API, lists a client’s workflows, and allows administrators to sync workflow metadata from n8n.

## Environment

Create a `.env` (or `.env.local`) alongside this README:

```bash
cp .env.example .env
```

- `VITE_API_BASE_URL` – base URL for the backend API (defaults to `http://localhost:4000/api`).

## Local Development

> Requires Node.js ≥ 18.

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` and use the seeded credentials (`admin@example.com` / `password123`, etc.). The dev server proxies requests directly to the backend instance defined by `VITE_API_BASE_URL`.

## Production Build

```bash
npm run build
npm run preview
```

The Dockerfile in this directory builds the static assets and serves them via nginx (port 80 inside the container).
