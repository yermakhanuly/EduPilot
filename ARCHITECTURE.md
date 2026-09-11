# EduPilot — Architecture & Complete File Reference

A complete map of every file, technology, and pipeline in the project. Use this as the single source of truth for understanding, extending, or deploying the system.

---

## 1. System Overview & Architecture

```
                                  ┌──────────────────────────────────────────────┐
                                  │               Browser (User)                 │
                                  │   React 19 SPA (edupilot.biz / port 5173)    │
                                  └──────────────────────┬───────────────────────┘
                                                         │ HTTPS (Cookies: accessToken, refreshToken)
                                                         │ SSE Streaming (GET/POST /assistant/...)
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │              Nginx Reverse Proxy             │
                                  │          (Frontend container / port 80)      │
                                  └──────────────┬────────────────┬──────────────┘
                                                 │                │
                                      / (Static React App)     /api/* (Proxy pass)
                                                 │                │
                                                 ▼                ▼
                                   ┌─────────────────────────────────────────────┐
                                   │         Express API (Node.js / port 4000)   │
                                   │                                             │
                                   │  CORS ──► cookie-parser ──► Request ID ──►  │
                                   │  JSON parser ──► Rate Limiter ──► Router    │
                                   └──────────────┬──────────────────┬───────────┘
                                                  │                  │
                                                  ▼                  ▼
                                     ┌──────────────────┐   ┌────────────────────┐
                                     │ PostgreSQL 16    │   │ ChromaDB           │
                                     │ Prisma ORM       │   │ Vector Database    │
                                     │ (12 DB models)   │   │ Distance <= 0.82   │
                                     └──────────────────┘   └────────┬───────────┘
                                                                     │
                                  ┌──────────────────────────────────┴───────────┐
                                  │ External Services & APIs                    │
                                  │  • Anthropic Claude (claude-haiku-4-5)       │
                                  │  • Google Gemini (gemini-embedding-001)     │
                                  │  • Canvas LMS REST API (OAuth & Webhooks)    │
                                  └──────────────────────────────────────────────┘
```

The system comprises four containerized services managed by **Docker Compose**:
1. **`frontend`**: Nginx web server hosting the compiled React 19 production build and proxying `/api/*` to backend:4000.
2. **`backend`**: Node.js 22 ESM Express server handling business logic, authentication, Canvas synchronization, document ingestion, and LangGraph/Claude AI assistant orchestration.
3. **`postgres`**: PostgreSQL 16 database storing user accounts, schedules, tasks, stats, study sessions, Canvas tokens, course definitions, and persistent AI conversations.
4. **`chroma`**: ChromaDB vector store running cosine similarity search over text chunks extracted from uploaded PDF/DOCX/PPTX files and Canvas course content.

---

## 2. Technology Stack & Key Dependencies

### Backend Technology

| Technology | Role & Purpose in Project |
|---|---|
| **Node.js 22 (ESM)** | Modern JavaScript runtime with native module syntax (`"type": "module"`). |
| **Express.js 4** | Web server framework handling API routing, middleware chaining, and SSE streaming. |
| **Prisma ORM 6** | Type-safe database client and migration tool managing PostgreSQL schemas and queries. |
| **PostgreSQL 16** | Relational database for all persistent application data, user accounts, and AI conversation history. |
| **ChromaDB 3.5** | High-performance vector database storing document chunk embeddings for RAG retrieval. |
| **Google Gemini API (`@google/genai`)** | Embedding model (`gemini-embedding-001`) generating 768-dimensional vectors for text chunks. |
| **Anthropic Claude API (`@langchain/anthropic`)** | Conversational LLM (`claude-haiku-4-5-20251001`) driving the AI study coach with tool calling and SSE streaming. |
| **LangChain & LangGraph (`@langchain/core`, `@langchain/langgraph`)** | Agentic workflow framework managing tool execution, state transitions, and event streaming. |
| **Zod 3** | Environment variable and API request validation schema engine with fail-fast boot checks. |
| **jsonwebtoken & bcryptjs** | Stateless JWT authentication (15m access / 7d refresh) and password hashing (cost factor 10). |
| **multer** | Memory-storage multipart upload middleware for user document ingestion. |
| **pdf-parse & officeparser** | Text extraction engines converting PDF, DOCX, and PPTX slide structures into clean text chunks. |
| **crypto (Node native)** | AES-256-GCM encryption for Canvas tokens and HMAC-SHA256 verification for Canvas webhooks. |

### Frontend Technology

| Technology | Role & Purpose in Project |
|---|---|
| **React 19** | UI framework utilizing functional components, hooks, and clean state design. |
| **Vite 7** | Development server with instant HMR and production bundler. |
| **React Router 7** | Multi-layout client-side routing (`PublicLayout`, `AppLayout`, `StrictLayout`). |
| **@tanstack/react-query 5** | Server-state cache managing optimistic updates, background refetching, and cache invalidation. |
| **Zustand 4** | Lightweight state store managing auth user state, theme preferences, strict timer state, and active chat IDs. |
| **Nginx 1.27** | High-performance web server serving static SPA assets and proxying API traffic in production containers. |

---

## 3. Complete Repository & File Map

### Root Configuration & Orchestration Files

- **`docker-compose.yml`**: Defines the 4-tier stack (`postgres`, `chroma`, `backend`, `frontend`), environment wiring, port bindings, health checks, and persistent volumes (`postgres-data`, `chroma-data`).
- **`.dockerignore`**: Excludes local node_modules, build outputs, environment files, and git artifacts from Docker contexts.
- **`README.md`**: Project overview, user guide, development instructions, deployment procedures, and troubleshooting guide.
- **`CLAUDE.md`**: Developer guidance reference for agentic AI tools and coding conventions.
- **`ARCHITECTURE.md`**: (This file) Complete technical reference, file catalog, system data flows, and pipeline descriptions.

---

### Backend Directory (`backend/`)

#### Root & Container Config
- **`backend/Dockerfile`**: Alpine Node.js container setup running Prisma generation, database migration deployment, and production server startup.
- **`backend/.dockerignore`**: Backend-specific build exclusions.
- **`backend/.env.example`**: Template environment variable file showing all required and optional keys.
- **`backend/package.json`**: Backend dependencies, scripts (`dev`, `start`, `lint`, `test`), and ESM project configuration.
- **`backend/package-lock.json`**: Exact dependency version tree for backend packages.

#### Database (`backend/prisma/`)
- **`backend/prisma/schema.prisma`**: Single source of truth for relational models (`User`, `UserStats`, `Task`, `WeeklyClass`, `FixedEvent`, `StudyBlock`, `StudySession`, `Reward`, `IntegrationCanvas`, `Course`, `KnowledgeDocument`, `Conversation`, `ChatMessage`).
- **`backend/prisma/migrations/`**: Directory containing timestamped SQL migration files tracking database schema evolution over time.

#### Source Entry & Config (`backend/src/`)
- **`backend/src/index.js`**: Server bootstrap file. Configures CORS, JSON body parser with raw-body preservation for webhooks, cookie parser, request ID middleware, health check endpoint, route mounting, error handling, and background Canvas sync timer.
- **`backend/src/config/env.js`**: Zod schema validating required (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`) and optional environment variables on boot.
- **`backend/src/config/prisma.js`**: Reusable singleton instance of `PrismaClient` to maintain database connection pooling across service modules.

#### Middleware (`backend/src/middleware/`)
- **`backend/src/middleware/requireAuth.js`**: Authentication guard verifying httpOnly JWT access cookies, issuing new cookie pairs (`issueTokens`), clearing cookies on logout (`clearAuthCookies`), and attaching `req.user`.
- **`backend/src/middleware/assistantRateLimit.js`**: Sliding window rate-limiter for AI endpoints (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) with structured latency and status logging.

#### Utilities (`backend/src/utils/`)
- **`backend/src/utils/crypto.js`**: AES-256-GCM encryption/decryption utilities for secure at-rest storage of user Canvas access tokens.

#### REST Routes (`backend/src/routes/`)
- **`backend/src/routes/auth.js`**: Authentication handlers (`/signup`, `/login`, `/logout`, `/refresh`, `/me`) managing password hashing, user registration, token issuance, and profile fetching.
- **`backend/src/routes/tasks.js`**: Task management CRUD (`GET`, `POST`, `PATCH`, `DELETE`). Automatically prunes past deadlines and awards XP on task completion.
- **`backend/src/routes/classes.js`**: Weekly recurring class schedule CRUD (`GET`, `POST`, `DELETE`).
- **`backend/src/routes/events.js`**: One-off fixed events (exams, appointments) CRUD (`GET`, `POST`, `DELETE`). Auto-prunes past events.
- **`backend/src/routes/plan.js`**: Study planner endpoints (`/generate`, `/reoptimize`, `/blocks`). Invokes planner logic and saves `StudyBlock` records.
- **`backend/src/routes/sessions.js`**: Focus session lifecycle endpoints (`/start`, `/finish`). Computes XP multipliers, streak bonuses, daily limits, and level progression in database transactions.
- **`backend/src/routes/stats.js`**: Gamification and user metrics endpoints (`/overview`, `/weekly`, `/leaderboard`).
- **`backend/src/routes/rewards.js`**: Custom reward shop listing endpoints (`/rewards`).
- **`backend/src/routes/canvas.js`**: Canvas LMS integration endpoints (`/connect`, `/sync`, `/knowledge-sync`, `/courses`, `/week`, `/webhook`). Manages token storage, profile verification, data synchronization, and HMAC webhook processing.
- **`backend/src/routes/assistant.js`**: AI workspace endpoints (`/conversations`, `/courses`, `/conversations/:id/messages`, `/messages/:id/branch`, `/messages/:id/regenerate`, `/ask`). Supports SSE event streaming (`text/event-stream`), conversation branching, and context building.
- **`backend/src/routes/knowledge.js`**: Knowledge base and document management endpoints (`/courses`, `/documents`, `/retry-failed`). Manages manual courses, document uploads, and failed indexing retries.

#### Business Logic Services (`backend/src/services/`)
- **`backend/src/services/planner.js`**: Pure scheduling algorithm. Calculates availability windows, subtracts fixed classes/exams, orders tasks by priority and deadline, and allocates 50-minute study blocks.
- **`backend/src/services/xp.js`**: Gamification logic. Calculates difficulty, urgency, strict mode, and streak multipliers, level boundaries (`floor(sqrt(totalXp / 100))`), and weekly stats.
- **`backend/src/services/canvas.js`**: Low-level Canvas API client. Encrypts/decrypts tokens, handles paginated REST calls with timeout and retries, maps Canvas planner items to internal tasks and classes, and executes sync transactions.
- **`backend/src/services/canvasSync.js`**: Background worker executing periodic Canvas data synchronization across registered users.
- **`backend/src/services/canvasKnowledge.js`**: Ingests Canvas course front pages, module files, page content, and announcements into the RAG vector knowledge base with partial-failure resilience.
- **`backend/src/services/documentIngestion.js`**: File processing service. Parses PDF, DOCX, PPTX, TXT, Markdown, and HTML files, extracts slide/page metadata, chunks text, and embeds vectors into ChromaDB.
- **`backend/src/services/embeddings.js`**: Google Gemini API client wrapping `gemini-embedding-001` for document chunking and query vectorization.
- **`backend/src/services/vectorStore.js`**: ChromaDB vector store client. Performs cosine similarity queries filtered by `userId`, optional `courseId`, and distance threshold (`<= 0.82`).
- **`backend/src/services/retriever.js`**: High-level retrieval interface connecting user queries to Gemini query embeddings and ChromaDB vector search.
- **`backend/src/services/assistantAgent.js`**: Core AI agent service using LangGraph and Anthropic Claude. Registers internal app actions as tools (`add_task`, `add_class`, `add_event`, `generate_plan`, `set_theme`, `navigate`, `search_course_materials`), executes tool workflows, and streams status/delta events.

#### Test Suites (`backend/src/**/__tests__/`)
- **`backend/src/services/__tests__/planner.test.js`**: Unit tests verifying deterministic scheduling logic and availability constraint handling.
- **`backend/src/services/__tests__/assistantRateLimit.test.js`**: Unit tests verifying sliding window rate limits and response headers.
- **`backend/src/services/__tests__/canvasKnowledge.test.js`**: Unit tests verifying error isolation during Canvas knowledge ingestion.
- **`backend/src/services/__tests__/vectorStore.test.js`**: Unit tests verifying ChromaDB query filter construction and distance thresholding.
- **`backend/src/services/__tests__/assistantAgent.test.js`**: Unit tests verifying Claude title generation and AI assistant module behavior.
- **`backend/src/routes/__tests__/assistantAuth.test.js`**: Integration tests verifying cross-user conversation ownership, course context validation, and access denial.
- **`backend/src/routes/__tests__/assistantHelpers.test.js`**: Unit tests for class formatting, context assembly, and helper queries.

---

### Frontend Directory (`frontend/`)

#### Root & Container Config
- **`frontend/Dockerfile`**: Multi-stage Docker build producing Vite production dist assets and serving them via Alpine Nginx.
- **`frontend/nginx.conf`**: Nginx web server configuration serving static React files on port 80 and proxying `/api/` to `backend:4000`.
- **`frontend/.dockerignore`**: Frontend-specific build exclusions.
- **`frontend/package.json`**: Frontend dependencies (React 19, React Router 7, TanStack Query, Zustand, Vite) and scripts (`dev`, `build`, `lint`, `preview`).
- **`frontend/package-lock.json`**: Exact dependency lockfile for frontend packages.
- **`frontend/vite.config.js`**: Vite build configuration including local development proxy setup forwarding `/api` to port 4000.
- **`frontend/eslint.config.js`**: ESLint flat configuration for React hooks, JSX, and code quality rules.
- **`frontend/index.html`**: Main HTML template loading Vite entry script (`/src/main.jsx`).

#### Core Shell & Entry (`frontend/src/`)
- **`frontend/src/main.jsx`**: Application entry point. Mounts the React application tree inside `QueryClientProvider` and renders `App`.
- **`frontend/src/App.jsx`**: Root component. Checks session auth (`authApi.me`), initializes theme custom data attributes, and renders `RouterProvider`.
- **`frontend/src/router.jsx`**: Router tree definition grouping routes under `PublicLayout`, `AppLayout`, and `StrictLayout`.
- **`frontend/src/index.css`**: Global CSS variables, theme design tokens (dark/light), typography, and reset styles.
- **`frontend/src/App.css`**: Complete component styling, layout grids, gamification card borders, assistant workspace styles, and responsive media queries.

#### API Client (`frontend/src/api/client.js`)
Centralized HTTP client wrapping `fetch`. Automatically attaches credentials (cookies), handles 401 token refresh retries, processes standard JSON responses, and implements SSE event streaming reader (`streamRequest`) for real-time AI assistant responses.

#### State Stores (`frontend/src/store/`)
- **`frontend/src/store/authStore.js`**: Zustand store managing current user session state (`user`, `setUser`, `logout`).
- **`frontend/src/store/themeStore.js`**: Zustand store managing theme preferences (`dark` vs `light`), persisted to `localStorage`.
- **`frontend/src/store/strictStore.js`**: Zustand store managing active focus sprint state (`active`, `mode`, `endsAt`, `focusMinutes`, `breakMinutes`).
- **`frontend/src/store/assistantStore.js`**: Zustand store managing active conversation selection (`activeConversationId`, `setActiveConversationId`) shared between the floating FAB and full Assistant workspace.

#### Layout Shells (`frontend/src/layouts/`)
- **`frontend/src/layouts/PublicLayout.jsx`**: Public navigation layout for landing, login, and signup pages.
- **`frontend/src/layouts/AppLayout.jsx`**: Authenticated layout featuring sidebar navigation, topbar with streak/level badges, content shell, mobile bottom bar, and global `<AssistantPanel />` floating FAB.
- **`frontend/src/layouts/StrictLayout.jsx`**: Full-screen distraction-free layout for focus sessions with all main navigation hidden.

#### Page Components (`frontend/src/pages/`)
- **`frontend/src/pages/LandingPage.jsx`**: Product landing page highlighting timetable features, Canvas integration, gamification, and AI study coaching.
- **`frontend/src/pages/LoginPage.jsx`**: User login form with client validation and auth store update.
- **`frontend/src/pages/SignupPage.jsx`**: Account creation form creating user and stats records.
- **`frontend/src/pages/DashboardPage.jsx`**: Main user dashboard displaying streak/level stats, upcoming deadlines, weekly focus blocks, and quick action cards.
- **`frontend/src/pages/PlanPage.jsx`**: Weekly timetable page with class, event, and task schedule generation and interactive study block display.
- **`frontend/src/pages/TasksPage.jsx`**: Task management page featuring task creation, priority/difficulty adjustments, deadline formatting, and completion XP awards.
- **`frontend/src/pages/ProgressPage.jsx`**: Analytics page displaying focus time charts, level progression, and global XP leaderboard.
- **`frontend/src/pages/RewardsPage.jsx`**: Gamification shop page where users spend earned XP to unlock custom user rewards.
- **`frontend/src/pages/SettingsPage.jsx`**: Account preferences page for theme toggling, strict timer duration adjustments, and logout.
- **`frontend/src/pages/CanvasIntegrationPage.jsx`**: Canvas LMS settings page managing API tokens, manual syncs, and course material indexing triggers.
- **`frontend/src/pages/MaterialsPage.jsx`**: Knowledge base management page with course accordions (`▶`/`▼`), manual course creation, file uploads (PDF, DOCX, PPTX, text), and retry controls for failed indexing.
- **`frontend/src/pages/AssistantPage.jsx`**: Full-screen AI workspace. Supports conversation creation, title search, course context filtering, active-branch message history, real-time SSE streaming, tool activity badges, inline message branching/editing, response regeneration, copy actions, and mobile conversation drawers.
- **`frontend/src/pages/StrictModePage.jsx`**: Full-screen focus sprint page with countdown timer, ambient controls, task completion, and XP calculation.

#### Reusable UI Components & Helpers (`frontend/src/components/`, `hooks/`, `utils/`, `data/`)
- **`frontend/src/components/AssistantPanel.jsx`**: Floating AI assistant panel (FAB) available on all app pages. Shares the active conversation with `AssistantPage` and streams responses.
- **`frontend/src/components/FormattedText.jsx`**: Custom lightweight Markdown renderer supporting code blocks (`` ``` ``), inline code (`` `code` ``), bold (`**text**`), italics (`*text*`), bullet lists, numbered lists, and headings.
- **`frontend/src/hooks/usePageTitle.js`**: Hook dynamically setting `document.title` based on the active React Router location path.
- **`frontend/src/utils/time.js`**: Relative time formatting helper (`formatTimeUntil`) converting dates into human-readable deadline text ("Due in 2 days", "Past due").
- **`frontend/src/data/mockData.js`**: Fallback mock data structures for offline or initial UI prototyping.

### Runtime State Ownership

| State | Owner | Persistence / Scope |
|---|---|---|
| Authenticated user and session bootstrap | `authStore` + httpOnly cookies | Cookies persist the session; user object is in memory. |
| Theme preference | `themeStore` | `localStorage` under `edupilot-theme`. |
| Strict focus timer | `strictStore` | Timer configuration and active timer state use `localStorage`. |
| Active assistant conversation | `assistantStore` | Active conversation ID is shared between the FAB and full Assistant page. |
| Conversation history | PostgreSQL `Conversation` and `ChatMessage` models | Durable across browsers/devices; branches, sources, and actions are stored server-side. |
| Server data | TanStack React Query | In-memory cache; mutations invalidate affected query keys. |

---

## 4. End-to-End Data & Execution Pipelines

### Pipeline 1: AI Assistant Chat with Real-Time SSE Streaming & Tool Execution

```
User types prompt on AssistantPage or AssistantPanel
                        │
                        ▼
          POST /assistant/conversations/:id/messages (SSE mode)
                        │
                        ├─► verify auth & ownership
                        ├─► load active message branch history (last 20)
                        ├─► insert user ChatMessage record
                        └─► invoke runAssistant({ onEvent, signal })
                                      │
                                      ▼
                        LangGraph Agent Loop
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          ▼                                                       ▼
   Tool Called (e.g. search_course_materials)             LLM Token Chunk
          │                                                       │
          ▼                                                       ▼
onEvent({ type: 'status' })                            onEvent({ type: 'delta' })
  "⚡ Searching course materials..."                      Streams text tokens
          │                                                       │
          ▼                                                       ▼
res.write("data: {...}\n\n")                            res.write("data: {...}\n\n")
          │                                                       │
          └───────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
                        Agent Loop Completes
                                      │
                        ├─► insert assistant ChatMessage record (with sources & actions JSON)
                        ├─► auto-generate title on 1st message (generateConversationTitle)
                        └─► res.write("data: { type: 'done', ... }\n\n")
```

---

### Pipeline 2: Document Ingestion & RAG Vector Search

```
User uploads PDF / PPTX on MaterialsPage  OR  Canvas Knowledge Sync runs
                        │
                        ▼
          POST /knowledge/documents (or syncCanvasKnowledge)
                        │
                        ├─► validate format & calculate SHA-256 checksum
                        ├─► insert KnowledgeDocument record (status: 'processing')
                        └─► ingestDocument()
                                      │
                                      ▼
          extractChunks(buffer, mimeType, filename)
            • PDF: parse page numbers & split into ~3500 char chunks
            • PPTX: OfficeParser AST ──► merge slide text ──► slideNumber metadata
            • DOCX / Text: clean whitespace ──► split into chunks
                                      │
                                      ▼
          embedDocuments(texts) ──► Gemini API (gemini-embedding-001)
                                      │
                                      ▼
          addChunks() ──► Upsert embeddings & metadata into ChromaDB
                                      │
                                      ▼
          Update KnowledgeDocument (status: 'ready')
```

---

### Pipeline 3: Course-Scoped Vector Retrieval

```
Assistant invokes search_course_materials tool
                        │
                        ▼
          searchCourseMaterials({ query, userId, courseId, limit: 6 })
                        │
                        ├─► embedQuery(query) ──► Gemini API
                        └─► searchChunks({ embedding, userId, courseId, maxDistance: 0.82 })
                                      │
                                      ▼
                        ChromaDB Cosine Search
                                      │
                        Filter: userId AND courseId (if selected)
                        Filter: distance <= 0.82 (rejects irrelevant chunks)
                                      │
                                      ▼
                        Return top matching excerpts + metadata
                        (document title, page number, slide number, heading)
```

---

### Pipeline 4: Automated Study Planner Algorithm

```
User clicks "Build plan" on PlanPage
                        │
                        ▼
          POST /plan/generate?weekStart=YYYY-MM-DD
                        │
                        ├─► load pending tasks, weekly classes, and fixed events
                        └─► generatePlan({ weekStart, tasks, fixedEvents, availabilityRules })
                                      │
                                      ▼
          1. buildAvailabilityWindows (Mon-Sun 08:00-23:59)
          2. subtractFixedEvents (subtract class/exam slots, preserve >= 25m gaps)
          3. sortTasks (Priority DESC ──► Deadline ASC ──► Title ASC)
          4. allocateBlocks (allocate 50m focus slots + 10m buffers)
                                      │
                                      ▼
          Prisma Transaction:
            • delete existing StudyBlock records for week
            • insert new StudyBlock records
```

---

### Pipeline 5: Gamified Focus Sprint & XP Calculation

```
User completes focus sprint on StrictModePage
                        │
                        ▼
          POST /sessions/finish { sessionId, focusedMinutes, completed, strictMode }
                        │
                        ├─► verify valid session (completed & focusedMinutes >= 10)
                        └─► computeSessionBaseXp():
                              minutes * 1.0
                              * difficultyMultiplier (easy 1x, medium 1.25x, hard 1.5x)
                              * urgencyMultiplier (<24h 1.2x, <72h 1.1x, else 1.0x)
                              * strictModeMultiplier (1.15x)
                                      │
                                      ▼
                        Daily Bookkeeping & Streak Check:
                          • update streak counter (resets if gap > 1 day)
                          • apply streak multiplier (4+ days 1.05x, 8+ 1.1x, 15+ 1.2x)
                          • recalculate total XP & level: floor(sqrt(totalXp / 100))
                                      │
                                      ▼
                        Prisma Transaction:
                          • update StudySession record
                          • update UserStats record
                          • mark linked Task / StudyBlock complete
```

---

## 5. Production Deployment on AWS Lightsail (`edupilot.biz`)

The application is deployed on an **AWS Lightsail** instance running Ubuntu / Docker Compose behind Cloudflare DNS and Nginx HTTPS termination.

### Production Topology & Environment Setup

1. **Domain & Network**:
   - Primary domain: `https://edupilot.biz`
   - Cloudflare manages DNS records and proxies HTTPS traffic to the Lightsail instance.
   - Lightsail firewall exposes ports `80` (HTTP) and `443` (HTTPS).

2. **Docker Compose Production Stack**:
   - `frontend`: Serves optimized React dist files via Nginx. Proxy-passes `/api/` to `http://backend:4000/`.
   - `backend`: Runs Node.js Express API. Connects internally to `postgres:5432` and `chroma:8000`.
   - `postgres`: PostgreSQL 16 container backed by persistent named volume `postgres-data`.
   - `chroma`: ChromaDB vector database container backed by persistent named volume `chroma-data`.

3. **Production Deployment Procedure**:

```bash
# SSH into the AWS Lightsail production server
ssh ubuntu@edupilot.biz

# Navigate to project repository and pull latest changes from main branch
cd ~/EduPilot
git pull origin main

# Rebuild and restart the production Docker container stack
docker compose build --no-cache
docker compose up -d

# Verify container liveness and database migration status
docker compose ps
docker compose exec backend npx prisma migrate status
docker compose exec backend node -e "fetch('http://127.0.0.1:4000/health').then(r=>r.json()).then(console.log)"
```

4. **Production Environment Variables (`backend/.env`)**:

```env
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://edupilot.biz
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
JWT_ACCESS_SECRET=PRODUCTION_ACCESS_SECRET_32_CHARS
JWT_REFRESH_SECRET=PRODUCTION_REFRESH_SECRET_32_CHARS
ENCRYPTION_KEY=PRODUCTION_CANVAS_ENCRYPTION_KEY_32_CHARS
COOKIE_DOMAIN=edupilot.biz
COOKIE_SECURE=true
ANTHROPIC_API_KEY=sk-ant-api03-...
ASSISTANT_RATE_LIMIT=20
ASSISTANT_RATE_WINDOW_MINUTES=1
GEMINI_API_KEY=AIzaSy...
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
CHROMA_URL=http://chroma:8000
DOCUMENT_MAX_SIZE_MB=10
CANVAS_SYNC_INTERVAL_MINUTES=60
CANVAS_REQUEST_TIMEOUT_MS=15000
CANVAS_REQUEST_RETRIES=2
```

---

## 6. Troubleshooting & Operations

| Symptom / Issue | Potential Cause | Verification & Resolution |
|---|---|---|
| **`502 Bad Gateway` on Canvas or API calls** | Backend container down or restarting due to missing env var or database connection issue. | Run `docker compose logs --tail=100 backend` to inspect boot logs. Ensure PostgreSQL container is healthy. |
| **`User location is not supported` on Gemini API** | Server IP address is in an unsupported region for Google Gemini embeddings API. | Verify egress IP with `docker compose exec backend node -e "fetch('https://ipinfo.io/json').then(r=>r.json()).then(console.log)"`. Ensure server or VPN exit node is in a supported country (e.g. US). |
| **Assistant returns 429 Too Many Requests** | User exceeded sliding rate limit (`ASSISTANT_RATE_LIMIT`, default 20/min). | Check response `Retry-After` header. Adjust limit in `.env` if required for heavy study sessions. |
| **Document stays in `processing` or `failed` status** | File buffer extraction failed or Gemini embedding API call timed out. | Go to `MaterialsPage`, view error message under document, and click `Retry failed`. |
| **Canvas materials not appearing under course** | Canvas API token invalid, or materials not published inside a course module. | Verify token on Canvas Integration page. Ensure files in Canvas are linked within an active module. |

## 7. Production Operations Checklist

The current production deployment is Docker Compose based. Do not use the previous PM2/static-file deployment recipe.

```bash
cd ~/EduPilot
git pull origin main
docker compose build --no-cache
docker compose up -d --force-recreate
docker compose ps
docker compose logs --tail=100 backend
docker compose exec backend node -e "fetch('http://127.0.0.1:4000/health').then(r=>r.json()).then(console.log)"
```

The Supabase pooler is used for runtime database access through `DATABASE_URL`; `DIRECT_URL` is used by Prisma for migrations. Existing Supabase data must be preserved. Resolve interrupted migrations only after inspecting the live schema and `_prisma_migrations` table.

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
