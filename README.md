# EduPilot

EduPilot is a gamified study tracker that helps students plan, track, and optimize their learning with XP, levels, and rewards. It includes a weekly timetable, task planning, Strict Mode focus sessions, Canvas import, and an AI helper.

## What You Can Do
- Plan your week with a visual timetable (Mon–Sun, 08:00–23:59).
- Add recurring weekly classes and fixed exams/assignments.
- Generate study blocks based on deadlines and availability.
- Earn XP from focus sessions and completing tasks.
- Use Strict Mode to stay focused with a timer and streak tracking.
- Import classes and assignments from Canvas.
- Index Canvas course pages and announcements for knowledge-aware answers.
- Upload PDF, DOCX, PPTX, TXT, Markdown, and HTML materials for text-based retrieval.
- Ask the AI helper for personalized scheduling advice and course-content answers (optional).

## How To Use The Website
1) **Create an account**
   - Sign up with your name, email, and password.
2) **Add weekly classes**
   - Go to the Plan page and add your recurring class times.
   - These repeat every week automatically.
3) **Add assignments and exams**
   - Add tasks with deadlines and estimated hours.
   - Add fixed events for exams or one-time sessions.
4) **Generate a plan**
   - Use “Build plan” to create focus blocks.
5) **Use Strict Mode**
   - Start a focus session and earn XP.
   - Adjust focus/break durations in Strict Mode settings.
6) **Use the AI helper (optional)**
   - Ask questions like “When should I study for my exam?”
7) **Canvas integration (optional)**
   - Connect with your Canvas base URL and access token.
   - Sync assignments and calendar events.

## XP System (Simple Summary)
- **Focus sessions** earn XP per minute (full credit only on completion).
- **Tasks** give a completion bonus.
- **Bonuses** apply for difficulty, urgency, strict mode, and streaks.

## Repository Structure
- `backend/` — Express API, Prisma schema, auth, planner, sessions, stats, Canvas routes.
- `frontend/` — Vite React app with public/app/strict layouts.
- `backend/prisma/schema.prisma` — DB models.
- `backend/src/services/planner.js` — Scheduling logic.
- `frontend/src/router.jsx` — App routing.

## Run Locally (Dev)

### Requirements
- Node.js 20+
- PostgreSQL (Supabase works)

### Backend
```bash
cd backend
npm install
```

Create `backend/.env` with:
```
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
ENCRYPTION_KEY=32+_chars_minimum
COOKIE_DOMAIN=
COOKIE_SECURE=false
ANTHROPIC_API_KEY=optional_for_AI_assistant_chat
ASSISTANT_RATE_LIMIT=20
ASSISTANT_RATE_WINDOW_MINUTES=1
GEMINI_API_KEY=optional_for_document_RAG_embeddings
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
CHROMA_URL=http://localhost:8000
DOCUMENT_MAX_SIZE_MB=10
CANVAS_WEBHOOK_SECRET=optional
CANVAS_SYNC_INTERVAL_MINUTES=0
```

Run migrations and start the API:
```bash
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Optional `frontend/.env`:
```
VITE_API_URL=http://localhost:4000
```

When running the frontend locally without `VITE_API_URL`, requests use the Vite
proxy at `/api` and are forwarded to `http://localhost:4000`.

## Production Notes
- Set `CORS_ORIGIN` to your production domain (https).
- Set `COOKIE_SECURE=true` and `COOKIE_DOMAIN=yourdomain.com`.
- Build frontend with `VITE_API_URL=https://yourdomain.com/api`.
- Run Prisma migrations: `npx prisma migrate deploy`.

## API Endpoints (Core)
- Auth: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Tasks: `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- Classes: `GET /classes`, `POST /classes`, `DELETE /classes/:id`
- Events: `GET /events`, `POST /events`, `DELETE /events/:id`
- Planner: `POST /plan/generate`, `GET /plan/blocks`
- Sessions/XP: `POST /sessions/start`, `POST /sessions/finish`
- Stats: `GET /stats/overview`, `GET /stats/weekly`, `GET /stats/leaderboard`
- Assistant: `GET/POST /assistant/conversations`, `POST /assistant/conversations/:id/messages` (SSE streaming), `POST /assistant/ask`
- Knowledge: `GET/POST/PATCH/DELETE /knowledge/courses`, `GET/POST/DELETE /knowledge/documents`, `POST /knowledge/retry-failed`
- Canvas: `POST /canvas/connect`, `POST /canvas/sync`, `POST /canvas/knowledge-sync`

## Troubleshooting
- **Login/session issues:** check `CORS_ORIGIN`, `COOKIE_DOMAIN`, and `COOKIE_SECURE`.
- **Canvas sync errors:** verify token and base URL, and set `CANVAS_SYNC_INTERVAL_MINUTES=0` if you want manual sync only.
- **AI helper errors:** ensure `ANTHROPIC_API_KEY` is set.
- **Document RAG errors:** ensure `GEMINI_API_KEY` and `CHROMA_URL` are configured. Uploaded documents support PDF, DOCX, PPTX, TXT, Markdown, and HTML formats. DOCX/PPTX files are indexed for text content; embedded images and slide visuals are not indexed in this first version.
- **Canvas knowledge sync:** individual files that cannot be fetched or embedded are marked as failed and skipped; other course materials continue indexing. Check the Materials page for the stored failure reason.

## Run With Docker Compose

Create `backend/.env` with the required application secrets and optionally add `ANTHROPIC_API_KEY` for chat and `GEMINI_API_KEY` for document RAG. Then run:

```bash
docker compose up --build
```

The frontend is available at `http://localhost:5173`, the API at `http://localhost:4000`, and Chroma is available only inside the Compose network. PostgreSQL and Chroma data persist in named Docker volumes.

---
If you need help, open an issue or contact the maintainer.
