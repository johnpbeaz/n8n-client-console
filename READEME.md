## Client Workflow Dashboard – Frontend Plan

### Objectives
- Provide a clean client-facing portal where authenticated users can see and run their assigned n8n workflows.
- Support an admin-only area to manage client-workflow assignments (front-end shell while backend endpoints are under development).
- Create a foundation that can expand to show run history, in-flight status, and error/debug information.

### Tech Stack & Tooling
- **Framework**: React with TypeScript.
- **Bundler**: Vite (fast dev server, easy TS support).
- **Routing**: React Router.
- **State/Data**: React Query for server cache + local component state for view/UI logic.
- **Auth**: Context-based auth provider consuming backend JWT endpoints.
- **Styling**: Tailwind CSS or Chakra UI (choose after initial wireframes; defaulting to Tailwind for flexibility).
- **Testing**: Vitest + React Testing Library for component coverage.
- **Lint/Format**: ESLint (typescript + react config), Prettier.

### High-Level Page Structure
1. **Auth**
   - `/login`: Email + password form, handles validation, shows auth errors, stores token on success.
2. **Client Experience**
   - `/dashboard`: Lists workflows assigned to the logged-in client. Cards show name, description, tags/status. Each card exposes a “Run Workflow” CTA.
   - `/runs/:runId`: Optional future route to show detailed run status (can be deferred). For MVP, results surface in a slide-over/modal after triggering run.
3. **Admin Experience**
   - `/admin`: Layout gated by `role === 'admin'`.
   - `/admin/clients`: Table of clients, CRUD actions (UI first, wiring later).
   - `/admin/clients/:clientId/workflows`: Dual-pane list (available vs assigned). Sync button to pull latest from n8n.

### Component Breakdown
- `AppShell`: Handles navigation, top bar, protected routes, layout.
- `AuthProvider`: Supplies auth context, token storage (localStorage) and refresh logic.
- `ProtectedRoute`: Wraps routes to enforce auth; optional role check.
- `WorkflowCard`: Displays workflow metadata, run button, status indicator.
- `RunStatusModal`: Shows pending/success/error states after trigger.
- `ClientSelector` (admin): Dropdown or list of clients.
- `WorkflowAssignmentList` (admin): Draggable or button-based assign/unassign.

### Data Flow & API Integration
- Upon login, backend returns JWT + role. Store in auth context; attach to `apiClient` (`fetch` wrapper).
- `GET /api/clients/me/workflows`: populates dashboard; response cached with React Query.
- `POST /api/workflows/:id/run`: triggers workflow; UI handles optimistic state, shows loading feedback.
- `GET /api/runs/:id`: polled for status (if run IDs are returned). For MVP, rely on immediate webhook response.
- Admin endpoints are stubbed on UI side; use mocked data until backend ready (isolate UI dev).

### State Management Notes
- React Query handles server state; keep minimal local state for modals/forms.
- For forms (login, admin CRUD) use `react-hook-form` for validation & ergonomics.
- Provide toast notifications via component library or `react-hot-toast`.

### Styling & UX
- Responsive layout targeting desktop-first but functional on tablet/mobile.
- Keep client dashboard minimal: headline, workflow cards, and run feedback.
- Admin views use tables and lists; emphasize clarity over visuals for MVP.

### Implementation Roadmap (UI)
1. Scaffold Vite + React + TS project with Tailwind, ESLint/Prettier.
2. Implement auth flow (context, login form, protected routes) with mocked API responses.
3. Build client dashboard UI with sample workflow data + run modal.
4. Create admin shell with client/workflow views using placeholder data.
5. Integrate actual backend endpoints as they become available; replace mocks incrementally.
6. Add Vitest/RTL tests for critical components (login form submission, workflow trigger interaction).

### Open Questions
- Finalize design system (Tailwind vs component library).
- Confirm run-status UX: modal vs separate page.
- Determine if clients need to view historical run logs within UI.

### Local Docker Preview
- Build the production bundle and container:
  ```bash
  cd frontend
  docker build -t ai-dashboard-frontend .
  ```
- Run the container on an unused port (5175 was chosen to avoid conflicts with current docker host ports):
  ```bash
  docker run --rm -p 5175:80 ai-dashboard-frontend
  ```
- Visit `http://localhost:5175` to interact with the mocked UI. Stop with `Ctrl+C`.

## Backend API – Service Plan

- **Runtime**: Node.js 20, Express, Prisma, PostgreSQL, JWT auth.
- **Core responsibilities**:
  - Authenticate users (`POST /api/auth/login`) and expose profile context (`GET /api/auth/me`).
  - Serve client dashboards (`GET /api/clients/me/workflows`, `GET /api/clients/me/workflows/:id/runs`).
  - Allow workflow execution against stored n8n webhooks (`POST /api/workflows/:id/run`) with auditable run logs.
  - Provide admin tooling for client management and n8n project sync (`/api/admin/...`).

### Docker Compose Stack

Launch the full stack (Postgres + API + React build) from the `ai-dashboard` directory:

```bash
cd ai-dashboard
docker compose up --build
```

- PostgreSQL → host port `5434`
- Backend API → host port `4000`
- Frontend SPA → host port `5175`

Edit `backend/.env.development` (or create `backend/.env`) before composing to supply a strong `JWT_SECRET` and your n8n API credentials if you want live sync behaviour.

- `N8N_BASE_URL` must include the REST scope (e.g. `https://your-n8n-host/api/v1/`).
- `Client.n8nProjectId` should match the `projectId` found in each workflow's `shared` metadata.

### Frontend → Backend API
- The React app reads `VITE_API_BASE_URL` (see `frontend/.env.example`). When using `docker compose`, the default value `http://localhost:4000/api` already targets the containerised API.
- Authentication tokens persist in localStorage and the dashboard/admin screens read live data from `/api/...`.
