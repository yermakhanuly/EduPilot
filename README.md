# EduPilot (JavaScript)

Gamified study tracker with deterministic scheduling, Strict Mode focus UI, Canvas token integration, and XP/streak mechanics. Frontend is Vite + React (JavaScript) with React Router, Zustand, and React Query. Backend is Express (JavaScript) with Prisma + Postgres, JWT cookies, and Canvas token storage.

## Repository Structure
- `backend/` — Express API (JS), Prisma schema, auth, planner, sessions, stats, Canvas routes.
- `frontend/` — Vite React app (JS) with public/app/strict layouts, Canvas integration form, planner/demo data.
- `backend/prisma/schema.prisma` — DB models (User, Task, StudyBlock, StudySession, Reward, UserStats, IntegrationCanvas).
- `backend/src/services/planner.js` — Deterministic scheduling algorithm + tests in `services/__tests__/planner.test.js`.
- `backend/src/middleware/requireAuth.js` — JWT cookie issuing + auth guard.
- `frontend/src/router.jsx` — Public/login/signup + app routes and Strict Mode layout.
- `frontend/src/pages/CanvasIntegrationPage.jsx` — Canvas base URL + token form with “Test connection”.

## Backend Setup
1) `cd backend`
2) Create `backend/.env` and set `DATABASE_URL`, `JWT_*` secrets, `ENCRYPTION_KEY` (32 chars), `CORS_ORIGIN`, `OPENAI_API_KEY` (for the assistant).
3) Install deps: `npm install`
4) Generate Prisma client / run migrations: `npx prisma generate` (add `prisma migrate dev --name init` once DB is ready).
5) Start API: `npm run dev` (uses `src/index.js`).
6) Run tests: `npm test` (Vitest, planner algorithm).

## Frontend Setup
1) `cd frontend`
2) Install deps: `npm install`
3) Start dev server: `npm run dev` (Vite on port 5173).
4) Build: `npm run build`

## Key Endpoints (API)
- Auth: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Tasks: `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- Weekly classes: `GET /classes`, `POST /classes`, `DELETE /classes/:id`
- Events: `GET /events`, `POST /events`, `DELETE /events/:id`
- Planner: `POST /plan/generate?weekStart=YYYY-MM-DD`, `POST /plan/reoptimize`
- Planner blocks: `GET /plan/blocks?weekStart=YYYY-MM-DD`
- Sessions/XP: `POST /sessions/start`, `POST /sessions/finish`, `GET /stats/weekly`, `GET /stats/overview`
- Rewards: `GET /rewards`
- Assistant: `POST /assistant/ask`
- Canvas: `POST /canvas/connect`, `POST /canvas/sync`, `POST /canvas/webhook` (for webhooks)
- Canvas: `POST /canvas/connect`, `GET /canvas/courses`, `GET /canvas/week`

## Notes
- Stack is now JavaScript end-to-end (TypeScript removed).
- Uses JWT in httpOnly cookies; CORS origin is configurable.
- Canvas personal access token is stored encrypted (`aes-256-gcm`) in `IntegrationCanvas`.
