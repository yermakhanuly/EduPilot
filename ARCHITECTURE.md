# EduPilot — Architecture & Pipeline Reference

A complete map of every file, every technology, and every end-to-end pipeline in the project. Use this as the single source of truth when on-boarding, debugging, or explaining the system.

---

## 1. Birds-eye view

```
                          ┌─────────────────────────────────────┐
                          │             Browser (User)          │
                          │   React 19 SPA — Vite dev or dist/  │
                          └──────────────┬──────────────────────┘
                                         │  HTTPS (cookies: accessToken, refreshToken)
                                         ▼
          ┌──────────────────────────────────────────────────────────┐
          │                Express API (Node.js, port 4000)           │
          │                                                           │
          │   CORS ─► cookie-parser ─► JSON body ─► Router ─► Route   │
          │                                   │                       │
          │                                   ▼                       │
          │                   Zod validation → Service layer          │
          │                                   │                       │
          │                                   ▼                       │
          │                         Prisma ORM (Client)               │
          └──────────────┬───────────────────────┬────────────────────┘
                         │                       │
                         ▼                       ▼
         ┌──────────────────────┐   ┌────────────────────────┐
         │  PostgreSQL (Prisma) │   │  External APIs          │
         │  10 tables           │   │  • Groq LLM             │
         │                      │   │  • Canvas LMS           │
         └──────────────────────┘   └────────────────────────┘

                               ┌───────────────┐
                               │ Background    │
                               │ Canvas sync   │ (setInterval, every 60m)
                               └───────────────┘
```

Two independent apps: **backend** (Express) and **frontend** (React). They communicate only through HTTP + cookies. No shared code.

---

## 2. Technologies — what each one is for

### Backend

| Tech | Purpose in this project |
|---|---|
| **Node.js (ESM)** | Runtime. `"type": "module"` in package.json — all imports use ES modules. |
| **Express 4** | HTTP server + routing. Each resource (`tasks`, `plan`, `auth`, etc.) is its own `Router`. |
| **Prisma 6** | Type-safe ORM. `schema.prisma` defines models; `prisma migrate` evolves the DB; `PrismaClient` issues queries. |
| **PostgreSQL** | Relational database. All persistent state — users, tasks, sessions, XP — lives here. |
| **Zod** | Runtime schema validation. Every route body and `process.env` is parsed with Zod before use — invalid input returns 400, invalid env fails boot. |
| **jsonwebtoken (JWT)** | Stateless auth. Signs short-lived access (15 min) and longer refresh (7 d) tokens. |
| **bcryptjs** | Password hashing (cost 10). Used only at signup / login. |
| **cookie-parser** | Reads the httpOnly `accessToken` / `refreshToken` cookies on each request. |
| **cors** | Allows the frontend origin (from `CORS_ORIGIN`) to call the API with credentials. |
| **dotenv** | Loads `.env` into `process.env` before Zod validates it. |
| **crypto (node built-in)** | AES-256-GCM encryption for Canvas tokens + HMAC-SHA256 for Canvas webhook signatures. |
| **ESLint 9** | Lint-only — no tests yet. `npm run lint`. |
| **Vitest** | Test runner (scaffolded, not populated). |

### Frontend

| Tech | Purpose in this project |
|---|---|
| **React 19** | UI framework. Function components + hooks only. |
| **Vite 7** | Dev server (HMR on port 5173) and production bundler (`vite build` → `dist/`). |
| **React Router 7** | Client-side routing. Three layouts: `PublicLayout`, `AppLayout`, `StrictLayout`. |
| **@tanstack/react-query 5** | Server-state cache. Every GET goes through `useQuery`; every mutation invalidates query keys. |
| **Zustand 4** | Tiny client-state store. Three stores: `authStore`, `themeStore`, `strictStore`. |
| **Zod** | Imported but mainly used server-side; frontend relies on native form validation + server errors. |

### Cross-cutting

| Tech | Purpose |
|---|---|
| **JWT in httpOnly cookies** | Prevents XSS from reading tokens. `credentials: 'include'` on the fetch client sends them automatically. |
| **LangGraph + Groq tool calling** | The `/assistant` route invokes a LangGraph agent backed by Groq; the model calls backend tools (add_task, generate_plan, …) instead of producing plain text. |
| **Canvas LMS REST API** | Source of truth for user assignments / exams / recurring classes. Imported into our DB so the planner can use them. |

---

## 3. Repository layout

```
EduPilot/
├── backend/                      # Express API
│   ├── prisma/
│   │   ├── schema.prisma         # DB model definitions
│   │   └── migrations/           # SQL migration history
│   ├── src/
│   │   ├── index.js              # App entry — wires middleware + routers
│   │   ├── config/
│   │   │   ├── env.js            # Zod-validated process.env → exported `env`
│   │   │   └── prisma.js         # Singleton PrismaClient
│   │   ├── middleware/
│   │   │   └── requireAuth.js    # verify JWT, attach req.user, cookie helpers
│   │   ├── routes/               # One file per REST resource (9 routers)
│   │   │   ├── auth.js
│   │   │   ├── tasks.js
│   │   │   ├── classes.js
│   │   │   ├── events.js
│   │   │   ├── plan.js
│   │   │   ├── sessions.js
│   │   │   ├── stats.js
│   │   │   ├── rewards.js
│   │   │   ├── canvas.js
│   │   │   └── assistant.js
│   │   ├── services/             # Pure business logic
│   │   │   ├── planner.js
│   │   │   ├── xp.js
│   │   │   ├── canvas.js
│   │   │   └── canvasSync.js
│   │   └── utils/
│   │       └── crypto.js         # AES-256-GCM encrypt/decrypt
│   └── package.json
│
├── frontend/                     # React SPA
│   ├── index.html                # Vite entry HTML
│   ├── src/
│   │   ├── main.jsx              # Mounts <App /> inside QueryClientProvider
│   │   ├── App.jsx               # Bootstraps auth + theme, renders Router
│   │   ├── router.jsx            # Route tree (3 layouts)
│   │   ├── index.css             # Design tokens (CSS custom properties)
│   │   ├── App.css               # Component styles
│   │   ├── api/
│   │   │   └── client.js         # fetch wrapper + per-resource objects
│   │   ├── store/                # Zustand stores (auth, theme, strict)
│   │   ├── layouts/              # PublicLayout, AppLayout, StrictLayout
│   │   ├── pages/                # 11 route components
│   │   ├── components/
│   │   │   └── AssistantPanel.jsx # AI chat FAB
│   │   ├── hooks/
│   │   │   └── usePageTitle.js
│   │   └── utils/
│   │       └── time.js           # formatTimeUntil()
│   └── package.json
│
├── CLAUDE.md                     # AI-assistant guidance for this repo
├── ARCHITECTURE.md               # (this file)
└── README.md
```

---

## 4. Backend — file-by-file

### `backend/src/index.js`
Bootstraps the Express app.
1. `app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }))` — whitelists frontend origins.
2. `express.json({ verify })` — parses JSON **and** saves the raw body on `req.rawBody` (needed for HMAC signature verification on Canvas webhooks).
3. `cookieParser()` — so routes can read `req.cookies.accessToken`.
4. `GET /health` — liveness probe.
5. Mounts 10 routers under their prefixes (`/auth`, `/tasks`, `/classes`, …).
6. Centralized error handler logs + returns `500`.
7. `app.listen(env.PORT)` and kicks off `scheduleCanvasSync(...)`.

### `backend/src/config/env.js`
Zod schema for every env var. **Fails the process on boot** if something required is missing (DATABASE_URL, JWT secrets, ENCRYPTION_KEY ≥ 32 chars). Optional vars: GROQ_API_KEY, CANVAS_WEBHOOK_SECRET, COOKIE_DOMAIN, CANVAS_SYNC_INTERVAL_MINUTES (default 60).

### `backend/src/config/prisma.js`
Exports a single `PrismaClient` instance. Reused everywhere to pool DB connections.

### `backend/src/middleware/requireAuth.js`
Three exports:
- `issueTokens(res, user)` — signs access (15 m) + refresh (7 d) JWTs and sets them as httpOnly cookies.
- `clearAuthCookies(res)` — on logout or invalid refresh.
- `requireAuth(req, res, next)` — verifies `req.cookies.accessToken`, attaches `req.user = { id, email }`, or returns 401.

### `backend/src/utils/crypto.js`
AES-256-GCM wrappers. Used by `services/canvas.js` to store the user's Canvas API token encrypted-at-rest. The 32-byte key comes from `env.ENCRYPTION_KEY`.
```
encrypt(plain) → base64(iv || authTag || ciphertext)
decrypt(blob)  → plaintext
```

### `backend/src/routes/auth.js`
| Endpoint | Behavior |
|---|---|
| `POST /auth/signup` | Validate, bcrypt-hash password, create `User` + empty `UserStats` in one query, issue tokens. |
| `POST /auth/login` | Find user, `bcrypt.compare`, issue tokens. |
| `POST /auth/logout` | Clear cookies. |
| `POST /auth/refresh` | Verify refresh cookie → re-issue both tokens. |
| `GET /auth/me` | Return the current user + stats (requires access token). |

### `backend/src/routes/tasks.js`
- On every `GET /tasks`: auto-prunes past-deadline tasks and completed manual tasks, then returns the rest ordered by deadline.
- `POST /tasks` — creates a manual task (status `pending`).
- `PATCH /tasks/:id` — can update any field; **when status transitions to `completed`**: sets `completedAt`, and if the task has been alive ≥ 5 min and hasn't been awarded yet, adds `+20 XP` to `UserStats` atomically (Prisma transaction).
- `DELETE /tasks/:id` — hard delete.

### `backend/src/routes/classes.js`
CRUD for recurring weekly classes. Day stored as `0..6` (0=Monday), start/end as `"HH:MM"` strings. Validates `end > start`.

### `backend/src/routes/events.js`
CRUD for one-off `FixedEvent`s (exams, appointments). Past events are auto-deleted on list.

### `backend/src/routes/plan.js`
Three endpoints, all operate on `weekStart` (ISO date of a Monday).
- `POST /plan/generate` — pulls tasks + classes + fixed events from DB (or uses body overrides), calls `generatePlan()`, deletes existing blocks for that week, inserts new ones.
- `POST /plan/reoptimize` — same but bumps the priority of `missedTaskIds` and tags output `source: "reoptimize"`.
- `GET /plan/blocks?weekStart=…` — returns the saved `StudyBlock`s for that week, joined with `task.title`.

### `backend/src/routes/sessions.js`
The XP loop lives here.
- `POST /sessions/start` — create `StudySession { status: 'in-progress' }`, mark the linked `StudyBlock` in-progress if any.
- `POST /sessions/finish` — the heart of gamification. See pipeline in §6.

### `backend/src/routes/stats.js`
- `GET /stats/overview` — returns `UserStats`, level info (from `levelFromXp`), and up to 5 upcoming tasks for the dashboard.
- `GET /stats/weekly` — aggregates the last 7 days of sessions.
- `GET /stats/leaderboard?limit=` — top users by `totalXp` (clamped 1..50).

### `backend/src/routes/rewards.js`
`GET /rewards` — lists the user's rewards (the creation side is currently manual / unused).

### `backend/src/routes/canvas.js`
- `POST /canvas/connect` — stores the encrypted token, verifies by calling `/api/v1/users/self/profile`, then imports the next 30 days.
- `POST /canvas/sync` — manual re-sync.
- `GET /canvas/courses` — proxy to Canvas courses.
- `GET /canvas/week?start=&end=` — proxy to Canvas planner items.
- `POST /canvas/webhook` — HMAC-SHA256 signature check (`verifyCanvasSignature`), then re-imports for the matching user.

### `backend/src/routes/assistant.js`
Agentic AI endpoint. See §8.

### Services

- **`services/planner.js`** — pure scheduling algorithm (no DB). Two exports: `generatePlan` and `reoptimizePlan`.
- **`services/xp.js`** — pure math: `difficultyMultiplier`, `urgencyMultiplier`, `strictModeMultiplier`, `streakBonusMultiplier`, `computeSessionBaseXp`, `applyStreakBonus`, `levelFromXp`, `computeWeeklyStats`.
- **`services/canvas.js`** — Canvas HTTP client + import logic. Handles pagination (`Link: rel="next"`), decrypts token per request, maps planner items to tasks / events / weekly classes, and runs the import inside a transaction.
- **`services/canvasSync.js`** — background job. `scheduleCanvasSync({ intervalMinutes })` sets a `setInterval` + 15-s initial delay, iterates every user with a Canvas token, calls `importCanvasData`, and uses a module-level `isSyncing` flag to avoid overlaps.

---

## 5. Frontend — file-by-file

### `frontend/src/main.jsx`
Creates the React root, wraps everything in `QueryClientProvider`, imports both CSS files.

### `frontend/src/App.jsx`
On mount, calls `authApi.me()` once and stores the result in `authStore`. Also subscribes to `themeStore` so the `data-theme` attribute stays applied. Renders `<RouterProvider router={router} />`.

### `frontend/src/router.jsx`
Three layout branches:
| Path | Layout | Children |
|---|---|---|
| `/`, `/login`, `/signup` | `PublicLayout` | landing + auth pages |
| `/app/*` | `AppLayout` (sidebar, topbar, assistant) | dashboard, plan, tasks, progress, rewards, settings, integrations/canvas |
| `/app/strict` | `StrictLayout` (full-screen timer) | StrictModePage |

Unknown paths redirect to `/`.

### `frontend/src/api/client.js`
Thin fetch wrapper.
- Base URL from `import.meta.env.VITE_API_URL` (default `http://localhost:4000`).
- Always sends `credentials: 'include'` so cookies ride along.
- **Auto-refresh on 401:** if a call returns 401 (and isn't one of login/signup/refresh), it calls `/auth/refresh` and retries the original once. If refresh fails, the original 401 surfaces.
- Exports one object per resource: `authApi`, `planApi`, `canvasApi`, `taskApi`, `classApi`, `eventApi`, `statsApi`, `sessionsApi`, `rewardsApi`, `assistantApi`.

### `frontend/src/store/authStore.js`
`{ user, setUser, logout }`. `user === undefined` means "not yet known" (used to block redirects).

### `frontend/src/store/themeStore.js`
`dark` or `light`, persisted to `localStorage` under `edupilot-theme`. Applies via `document.documentElement.dataset.theme = ...` so CSS variables in `:root[data-theme='light']` take effect.

### `frontend/src/store/strictStore.js`
Focus-timer state: `active`, `mode` (`focus` | `break`), `endsAt` (epoch ms), `focusMinutes`, `breakMinutes`. Durations persisted to localStorage.

### `frontend/src/layouts/PublicLayout.jsx`
Landing / login / signup shell — brand + nav, nothing else.

### `frontend/src/layouts/AppLayout.jsx`
Authenticated shell:
- Sidebar (with icon-enhanced nav items), topbar (streak / level pills, quick actions), mobile bottom nav (subset of links).
- Uses `useQuery(['stats-overview'])` to show streak + level in the topbar.
- Mounts `<AssistantPanel />` so the AI FAB is available on every app page except `/settings`.

### `frontend/src/layouts/StrictLayout.jsx`
Full-screen focus layout: big timer, "Exit Strict Mode" button. All other navigation is hidden while the sprint is active.

### Pages
| Page | Data it uses |
|---|---|
| `LandingPage` | Static marketing page. |
| `LoginPage` / `SignupPage` | `authApi.login` / `signup` → sets `authStore.user` → redirect `/app`. |
| `DashboardPage` | `statsApi.overview`, `planApi.blocks(weekStart)`. 4 semantic stat cards + today's plan + active tasks. |
| `PlanPage` | `planApi.blocks(weekStart)`, `planApi.generate(...)`, the CRUD APIs for classes/tasks/events to drive a timetable view. |
| `TasksPage` | `taskApi.list`, `create`, `update`, `remove`. Invalidates `['tasks']`, `['stats-overview']`, `['stats-weekly']`. |
| `ProgressPage` | `statsApi.overview`, `statsApi.weekly`, `statsApi.leaderboard`. |
| `RewardsPage` | `rewardsApi.list`. |
| `SettingsPage` | Toggles theme, edits strict-mode durations, lets the user log out. |
| `CanvasIntegrationPage` | `canvasApi.connect`, `sync`, `getCourses`. |
| `StrictModePage` | `planApi.blocks`, `rewardsApi.list`, `sessionsApi.start/finish`. Drives the focus timer + XP award flow. |

### `frontend/src/components/AssistantPanel.jsx`
Persistent chat FAB in the bottom-right of `AppLayout`. On submit:
1. Appends the user turn to local state + localStorage (`edupilot_chat_${userId}`).
2. Calls `assistantApi.ask({ question, history })` (last 20 turns).
3. On success, appends the assistant turn, applies `clientActions` (`set_theme`, `navigate`), and calls `queryClient.invalidateQueries({ queryKey: [key] })` for every key the server returned in `invalidateQueries`.

### `frontend/src/hooks/usePageTitle.js`
Syncs `document.title` with the current route.

### `frontend/src/utils/time.js`
`formatTimeUntil(deadline)` → `"Due in 3 days"`, `"Past due"`, `"No deadline"`, etc.

### `frontend/src/index.css` + `App.css`
CSS custom properties as design tokens (two themes), then component styles. Semantic gamification colors (`--color-xp` emerald, `--color-streak` amber, `--color-level` violet) drive stat-card left borders and pill variants.

---

## 6. The critical pipelines, step by step

### Pipeline A — Signup

```
POST /auth/signup { email, password, name }
  │
  ├─► Zod (signupSchema) validates input
  ├─► prisma.user.findUnique({ email })  — reject if exists (409)
  ├─► bcrypt.hash(password, 10)
  ├─► prisma.user.create({ ..., stats: { create: {} } })   — one txn
  ├─► issueTokens(res, user)  — sets 2 httpOnly cookies
  └─► 201 { user: { id, email, name } }
```

### Pipeline B — Every authenticated frontend request

```
Component ──► useQuery / useMutation
          └─► apiClient.request(path)
                 │ credentials: 'include'  (sends cookies)
                 ▼
           Express CORS check ──► cookieParser ──► JSON body
                                        │
                                        ▼
                                 requireAuth
                            jwt.verify(accessToken)
                                   │ OK           │ expired / invalid
                                   ▼              ▼
                              req.user = {id}    401
                                   │              │
                                   ▼              ▼
                              Route handler   Client sees 401
                                   │              │
                                   ▼              ▼
                              Zod validate   apiClient retries once
                                   │         after POST /auth/refresh
                                   ▼
                             Prisma query
                                   │
                                   ▼
                               res.json(...)
```

### Pipeline C — Create a task → show on dashboard

```
User fills form on TasksPage
      │
      ▼
createMutation.mutate(form)
      │
      ▼
taskApi.create() → POST /tasks
      │
      ▼  (requireAuth → Zod createTaskSchema → Prisma)
prisma.task.create({ ..., userId })
      │
      ▼
201 { task }
      │
      ▼
TasksPage.onSuccess:
   queryClient.invalidateQueries(['tasks'])
   queryClient.invalidateQueries(['stats-overview'])  (on update only)
      │
      ▼
Dashboard & Tasks pages refetch; UI updates.
```

### Pipeline D — Generate a weekly study plan

```
User clicks "Build plan" on PlanPage
      │
      ▼
POST /plan/generate?weekStart=YYYY-MM-DD
      │
      ▼  requireAuth → Zod planBodySchema
resolvePlanInputs(userId, body, weekStart):
   • pull tasks (status != completed, deadline >= now OR null)
   • prune stale tasks (past deadline, completed-manual)
   • pull weekly classes + fixed events
   • expand each class into concrete start/end for this week
   • merge classes+events into fixedEvents list
      │
      ▼
generatePlan({ weekStart, tasks, fixedEvents, availabilityRules })
   │
   ├── buildAvailabilityWindows   ──► [ { start, end } per day ]
   ├── subtractFixedEvents        ──► cuts classes/exams out of windows
   │                                  (keeps segments ≥ 25 min)
   ├── sortTasks                  ──► by priority desc → deadline asc → title
   └── allocateBlocks             ──► for each task, fill 50-min slots
                                     (+10 min buffer between blocks)
      │
      ▼
returns { blocks[], unscheduledTasks[], summary }
      │
      ▼
prisma.studyBlock.deleteMany (for that week)
prisma.studyBlock.createMany (new blocks)
      │
      ▼
200 { blocks, summary, unscheduledTasks }
      │
      ▼
PlanPage invalidates ['plan-blocks', weekStart]; UI re-renders.
```

### Pipeline E — Strict-mode focus session → XP award

```
User clicks "Start 45m focus" on StrictModePage
      │
      ▼
strictStore.start(45)         ─► client timer begins ticking
POST /sessions/start           ─► creates StudySession(status: 'in-progress')
                                   (also flips StudyBlock.status if blockId given)
      │
      │  … 45 minutes of focused work …
      │
      ▼
Timer reaches 0:
POST /sessions/finish { sessionId, focusedMinutes: 45, completed: true, strictMode: true }
      │
      ▼  requireAuth + Zod finishSchema
Look up session + userStats.
isValidSession = completed && focusedMinutes >= 10
      │
      ▼
baseSessionXp = computeSessionBaseXp({
    minutes,
    difficulty (from task), deadline (from task), strictMode
})
  = minutes × 1
    × difficultyMultiplier (easy 1, medium 1.25, hard 1.5)
    × urgencyMultiplier    (<24h 1.2, <72h 1.1, else 1)
    × strictModeMultiplier (1.15 if strict)
      │
      ▼
Daily bookkeeping (to make the streak bonus non-exploitable):
  isNewDay  = stats.dailyDate != today
  dailyBase = (isNewDay ? 0 : stats.dailyBaseXp) + baseSessionXp
  dailyXp   = dailyBase × streakBonusMultiplier(newStreak)
                            (4+ → 1.05, 8+ → 1.1, 15+ → 1.2)
  xpEarned  = max(0, dailyXp - dailyXpBefore)
      │
      ▼
Streak update:
  no prior session  → 1
  last session today → unchanged
  last session yesterday → +1
  else (gap) → 1
      │
      ▼
prisma.$transaction:
  • studySession.update { endedAt, focusedMinutes, status, xpEarned }
  • userStats.upsert   { totalXp, weeklyXp, streak, daily*, level = floor(sqrt(totalXp/100)) }
  • studyBlock status → completed / missed (if linked)
      │
      ▼
200 { session, xpEarned }
      │
      ▼
StrictModePage invalidates ['stats-overview','stats-weekly','rewards'];
Dashboard topbar & progress page update automatically.
```

### Pipeline F — Canvas connect → import

```
User pastes Canvas base URL + token on CanvasIntegrationPage
      │
      ▼
POST /canvas/connect
      │
      ▼
saveCanvasCredentials(userId, baseUrl, token)
   • encrypt(token) with AES-256-GCM (utils/crypto.js)
   • upsert IntegrationCanvas row
      │
      ▼
testCanvasConnection → GET /api/v1/users/self/profile on Canvas
      │
      ▼
saveCanvasProfile → store Canvas user id
      │
      ▼
importCanvasData(userId, defaultCanvasRange(30)):
   • Pull known completed externalIds (so we don't re-import finished tasks)
   • fetchCanvasWeek → /api/v1/planner/items?start=…&end=… (paginated via Link header)
   • For each item: mapPlannerItem →
        - assignment →  Task (source: 'canvas', externalId)
        - recurring calendar event → WeeklyClass
        - one-off calendar event → FixedEvent (type: 'exam')
   • Inside a single Prisma transaction:
        - delete existing canvas-source tasks (except completed)
        - delete existing canvas events + canvas classes
        - createMany new rows
        - update IntegrationCanvas.lastImportedAt
      │
      ▼
200 { success, profile, imported: { tasks, events, classes } }

Background: scheduleCanvasSync runs every CANVAS_SYNC_INTERVAL_MINUTES.
Webhook: POST /canvas/webhook → HMAC-SHA256 verify → importCanvasData for that Canvas user id.
```

### Pipeline G — AI assistant with tool calling

```
User types into AssistantPanel
      │
      ▼
POST /assistant/ask { question, history }
      │
      ▼  requireAuth + Zod askSchema
Build live context from DB:
  • upcoming tasks, weekly classes, upcoming fixed events
  • user stats, next 12 study blocks
      │
      ▼
systemMessages = [
  "You are EduPilot… (behaviour rules)
   Today's date is YYYY-MM-DD (year 2026).
   You MUST always call a tool. Use send_reply for plain replies.
   For dates without a year, assume current year.",
  "Current user data: <JSON context>"
]
      │
      ▼
LangGraph agent invocation with Groq and typed LangChain tools
      │
      ▼
The Groq-backed agent calls tools as needed. Tools available:
   add_class, remove_class, add_task, remove_task,
   add_event, remove_event, generate_plan,
   set_theme, navigate, send_reply
      │
      ▼
For each tool call, backend dispatches to Prisma:
   add_task     → prisma.task.create         (+invalidate tasks, stats-overview, stats-weekly)
   remove_task  → prisma.task.deleteMany     (+same)
   add_class    → prisma.weeklyClass.create  (+invalidate classes)
   add_event    → prisma.fixedEvent.create   (+invalidate events, stats-overview)
   generate_plan → run planner.generatePlan + replace StudyBlocks
   set_theme    → clientActions.push({ type:'set_theme', value })
   navigate     → clientActions.push({ type:'navigate', to })
   send_reply   → sendReplyText = args.message
      │
      ▼
Response:
  {
    answer:           sendReplyText || summary of actions,
    actionsPerformed: [...],
    clientActions:    [...],       // executed on the frontend
    invalidateQueries: [...]       // React Query keys to refetch
  }
      │
      ▼
AssistantPanel:
  • appends assistant message
  • setTheme / navigate for clientActions
  • queryClient.invalidateQueries for each key → UI everywhere updates
```

**Why `tool_choice: 'required'` + `send_reply`?** Previously `tool_choice: 'auto'` let the model reply with plain text that *claimed* "I added it!" without actually calling a tool — so no DB write happened. Forcing a tool call every turn (with `send_reply` as the no-op fallback) closes that gap.

---

## 7. Request → response flow (generic)

```
Browser                   Express                    Service               Prisma
   │                         │                          │                     │
   │── fetch(/resource) ───►│                          │                     │
   │  cookies attached       │── CORS / cookies ──►     │                     │
   │                         │── requireAuth ────►      │                     │
   │                         │── Zod parse ──────►      │                     │
   │                         │── handler ───────────────►                     │
   │                         │                          │── query/mutation ──►│
   │                         │                          │◄── rows ────────────│
   │                         │◄───────────── result ────│                     │
   │◄── JSON ────────────────│                          │                     │
   │                                                                          │
React Query caches result under queryKey; components re-render.
```

---

## 8. Database schema (visual)

```
┌────────┐ 1:1  ┌─────────────┐
│  User  │──────│  UserStats  │
│        │      └─────────────┘
│        │ 1:1  ┌──────────────────────┐
│        │──────│ IntegrationCanvas    │
│        │      └──────────────────────┘
│        │ 1:N  ┌─────────┐
│        │──────│  Task   │────────────┐
│        │      └────┬────┘            │
│        │           │ 1:N             │ 1:N
│        │           ▼                 ▼
│        │      ┌─────────────┐  ┌────────────────┐
│        │      │ StudyBlock  │──│ StudySession    │  (1:1 via blockId)
│        │      └─────────────┘  └────────────────┘
│        │ 1:N  ┌─────────────┐
│        │──────│ WeeklyClass │
│        │      └─────────────┘
│        │ 1:N  ┌─────────────┐
│        │──────│ FixedEvent  │
│        │      └─────────────┘
│        │ 1:N  ┌─────────┐
│        │──────│ Reward  │
└────────┘      └─────────┘
```

All FKs cascade on user deletion (`onDelete: Cascade`). `StudyBlock.task` uses `SetNull` so deleting a task doesn't wipe your history.

---

## 9. State & caching — where does state live?

| Type | Lives in | Examples |
|---|---|---|
| Auth state (who am I?) | `authStore` (Zustand, in-memory) | `user` |
| Theme | `themeStore` + `localStorage` | `dark` / `light` |
| Strict timer | `strictStore` + `localStorage` | `active`, `endsAt`, `focusMinutes` |
| Chat history | component state + `localStorage[edupilot_chat_${userId}]` | last 50 messages |
| Server state | **React Query cache**, keyed by tuples | `['tasks']`, `['stats-overview']`, `['plan-blocks', weekStart]`, `['rewards']` |
| Auth tokens | **httpOnly cookies** (not accessible to JS) | `accessToken`, `refreshToken` |
| Durable data | PostgreSQL | everything else |

React Query is the glue: mutations return, `invalidateQueries` is called, affected `useQuery`s refetch automatically.

---

## 10. Environment variables (complete)

### Backend
| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. |
| `JWT_ACCESS_SECRET` | ✅ | Signs 15-min access tokens. |
| `JWT_REFRESH_SECRET` | ✅ | Signs 7-day refresh tokens. |
| `ENCRYPTION_KEY` | ✅ (≥32 chars) | AES-256-GCM key for Canvas tokens. |
| `PORT` | — (4000) | API port. |
| `CORS_ORIGIN` | — (`http://localhost:5173`) | Comma-separated allowed origins. |
| `COOKIE_SECURE` | — (`false`) | Set `true` in prod for HTTPS cookies. |
| `COOKIE_DOMAIN` | — | Set to your domain in prod. |
| `GROQ_API_KEY` | optional | Enables `/assistant`. |
| `CANVAS_WEBHOOK_SECRET` | optional | Enables webhook signature verification. |
| `CANVAS_SYNC_INTERVAL_MINUTES` | — (60) | Background sync cadence, set 0 to disable. |

### Frontend
| Var | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | — (`http://localhost:4000`) | Base URL for all API calls. |

---

## 11. Deployment topology (Amazon Lightsail)

```
Internet ──► Nginx (80/443)
              │
              ├── /          → static files in /var/www/edupilot/ (vite build output)
              └── /api/*     → proxy_pass http://127.0.0.1:4000 (PM2 process `edupilot-api`)

PostgreSQL runs on the same instance (or a separate Lightsail DB).
PM2 keeps edupilot-api alive + restarts on crash.
```

Deploy recipe:
```bash
# On the server
cd ~/edupilot && git pull origin main
cd backend && npm install
pm2 restart edupilot-api --update-env
# Frontend (if changed)
cd ../frontend && npm install && npm run build
sudo cp -r dist/* /var/www/edupilot/
```

---

## 12. Common failure modes and where to look

| Symptom | Most likely cause | File |
|---|---|---|
| Every API call returns 401 | Cookies not being sent (missing `credentials: 'include'`) or expired refresh | `frontend/src/api/client.js`, `backend/src/middleware/requireAuth.js` |
| Plan has no blocks even with tasks | All tasks have `remainingHours === 0` (filtered out) or availability is fully consumed by classes | `services/planner.js` (`normalizeTasks`, `allocateBlocks`) |
| AI "adds" a task but DB unchanged | `tool_choice` reverted to `'auto'`; model went conversational | `routes/assistant.js` (ensure `'required'`) |
| AI uses wrong year for a date | System prompt missing current-date injection | `routes/assistant.js` (systemMessages) |
| Canvas token saved but import fails | Base URL has trailing slash, token permissions, or Canvas returning non-JSON | `services/canvas.js` (`fetchCanvasResource`, `fetchCanvasPaged`) |
| XP not increasing after a session | `focusedMinutes < 10` (session rejected as invalid) | `routes/sessions.js` (isValidSession) |
| Streak resets unexpectedly | Gap ≥ 2 days since last session | `routes/sessions.js` streak block |

---

## 13. Reading order if you're new

1. `backend/prisma/schema.prisma` — understand the data shapes.
2. `backend/src/index.js` — see how everything is wired.
3. `backend/src/middleware/requireAuth.js` — how auth works.
4. `backend/src/routes/sessions.js` + `services/xp.js` — the gamification loop.
5. `backend/src/services/planner.js` — the scheduling algorithm.
6. `backend/src/routes/assistant.js` — the agentic AI pattern.
7. `frontend/src/router.jsx` + the three layouts.
8. `frontend/src/api/client.js` — how all HTTP calls flow.
9. `frontend/src/pages/DashboardPage.jsx` and `StrictModePage.jsx` — the two richest pages.

That sequence takes you from raw data → auth → business logic → AI → UI in roughly the order the request hits the system.
