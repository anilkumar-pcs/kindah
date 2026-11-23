# Chillar / Kindly

A private-beta, mobile-first PWA for spontaneous, pseudonymous micro-gifts of ₹10–₹100 between people in Bengaluru. Kindly is **not** charity, crowdfunding or a wallet: donors pay recipients directly over UPI, and the platform does not hold, pool, escrow or settle funds.

**Current phase:** Phase 1 — foundation and runnable skeleton. No domain features are implemented yet.

## Stack

| Area | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, React 19, Tailwind CSS 4 |
| Backend | Python 3.12, FastAPI, Pydantic 2 |
| Persistence | SQLAlchemy 2 (sync), psycopg 3, Alembic, PostgreSQL 16 |
| Cache/rate limits | Redis (optional; never a correctness boundary) |
| Tests | pytest, HTTPX/TestClient, Vitest, Testing Library |
| CI | GitHub Actions |

## Prerequisites

- macOS/Linux with Homebrew (this repository was validated on macOS arm64)
- `uv` and Python 3.12+
- PostgreSQL 16
- Redis 7+ (optional for Phase 1; recommended)
- Node.js 22+ and npm

On macOS:

```bash
brew install uv postgresql@16 redis
uv python install 3.12
brew services start postgresql@16
brew services start redis
createdb kindah_dev
createdb kindah_test
```

## Quickstart

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local

make setup          # uv sync + npm install
make migrate        # alembic upgrade head

# Terminal 1
make run-api        # http://127.0.0.1:8000

# Terminal 2
make run-web        # http://localhost:3000
```

Verify the backend:

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/readyz
curl http://127.0.0.1:8000/api/v1/meta
```

The home page displays the backend service status. The API docs are at `http://127.0.0.1:8000/docs` outside production.

## Commands

| Command | Purpose |
|---|---|
| `make setup` | Install backend and frontend dependencies |
| `make db-create` | Create `kindah_dev` and `kindah_test` if missing |
| `make migrate` | Apply Alembic migrations |
| `make migrate-down` | Revert to the base revision (development only) |
| `make run-api` | Run FastAPI with reload on port 8000 |
| `make run-web` | Run Next.js on port 3000 |
| `make test` | Run backend and frontend tests |
| `make lint` | Ruff + ESLint |
| `make format` | Ruff format + Prettier write |
| `make format-check` | Verify formatting without writing |
| `make typecheck` | mypy + TypeScript |
| `make check` | Lint, format check, type check and all tests |

Backend commands can also be run directly from `backend/` with `uv run …`; frontend commands from `frontend/` with `npm run …`.

## Environment

`.env.example` documents every backend variable. Local placeholders are not production secrets. The application refuses to start in production if a `dev-only`, `test-only` or `change-me` secret remains, and it refuses live payment mode unless `PAYMENTS_LIVE_ENABLED=true` (which is not approved).

`frontend/.env.local` contains only `NEXT_PUBLIC_API_BASE_URL`. Never put secrets in `NEXT_PUBLIC_*`.

## Safety boundaries

- `PAYMENTS_LIVE_ENABLED=false` and `HANDOFF_MODE=test` are the defaults in every environment.
- Real-money production UPI handoff remains disabled until written legal and bank/payment-partner gates are cleared and the owner explicitly approves activation.
- Redis is for cache/rate limiting only. PostgreSQL is the correctness boundary.
- Public payloads, logs and analytics must never contain phone numbers, raw VPAs, UTRs, payment credentials or moderation notes.

## Documentation

- `docs/product/` — authoritative v1.1 product and engineering specification (`.docx`)
- `docs/implementation/IMPLEMENTATION_PLAN.md` — phased execution plan
- `docs/implementation/IMPLEMENTATION_STATUS.md` — current progress and blockers
- `docs/implementation/ARCHITECTURE.md` — proposed module boundaries and data flows
- `docs/implementation/DECISIONS.md` — decision log (proposals vs owner approvals)
- `docs/implementation/IMPLEMENTATION_BACKLOG.md` — repository-specific tasks and acceptance criteria
- `docs/implementation/TEST_EVIDENCE.md` — verification records

## Troubleshooting

- **`createdb: database already exists`** — safe to ignore; use `make db-create`.
- **`connection refused` on `/readyz`** — start PostgreSQL: `brew services start postgresql@16`.
- **Redis warnings** — Redis is optional in Phase 1; readiness reports `degraded` but the API stays up.
- **Python version error** — run `uv python install 3.12`; do not use the system Python 3.9.
- **Port already in use** — stop the other process or change the port in the command; CORS allows only the configured frontend origin.
