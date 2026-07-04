# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QMS v3 – Sistema de Gestión de QSO for the Federación Mexicana de Radioexperimentadores A.C. (FMRE). Tracks radio contact reports (RF) and social media engagement reports (RS) across events, stations, zones, and systems.

Stack: FastAPI + SQLAlchemy + PostgreSQL (backend), React + Vite + TypeScript + Ant Design (frontend). UI and code comments/identifiers are in Spanish.

## Commands

### Backend (`backend/`)
```bash
python -m venv venv && venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000        # run API (http://localhost:8000/api/docs)
python -m app.utils.seed                          # seed catalogs + admin user
pytest                                            # run tests (pytest/pytest-asyncio/httpx are deps, but no tests/ dir currently exists)
```

### Frontend (`frontend/`)
```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to localhost:8000 (see vite.config.ts)
npm run build      # tsc typecheck + vite build
npm run lint        # eslint, zero warnings allowed
```

### Docker (full stack)
```bash
docker compose up --build
docker compose exec backend python -m app.utils.seed
```

## Architecture

### RF vs RS parallel domains
The core structural pattern is that almost everything exists in **two parallel tracks**:
- **RF** ("radio frecuencia"): traditional radio QSO reports — `Reporte`, `router/reportes.py`, `LibretaConfigUsuario`-based monitoring in `router/libreta.py`.
- **RS** ("redes sociales"): social media engagement reports — `ReporteRS`, `EstadisticaRS`, `PlataformaRS`, `MetricaRS`, `router/reportes_rs.py`-equivalent logic in `router/libreta_rs.py`.

Frontend mirrors this: `Dashboard.tsx`/`DashboardRS.tsx`, `Estadisticas.tsx`/`EstadisticasRS.tsx`, `Libreta.tsx`/`LibretaRS.tsx`, `Reportes.tsx`/`ReportesRS.tsx`. When changing one side, check whether the RF/RS counterpart needs the same change. `Evento.categoria` (`'rf'|'rs'|'general'`) and `ReportePlantilla.tipo` (`'rf'|'rs'`) tag which track a record belongs to; report templates (`reporte_plantillas`) can target multiple events on each side via `eventos_rf_ids`/`eventos_rs_ids` JSONB arrays.

### No Alembic migrations — schema evolves in `main.py`
Despite `alembic` being a dependency, it is unused. All schema changes are plain `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / one-off `DO $$ ... $$` data-migration blocks run inside the `lifespan()` startup handler in `backend/app/main.py`. **When adding or changing a column, add a corresponding idempotent `IF NOT EXISTS` statement there** rather than creating a migration file — this is how the schema is kept in sync across environments on every restart. `Base.metadata.create_all()` handles brand-new tables; the manual SQL block handles everything added after the table already existed in production.

### Foreign keys replaced denormalized string columns
Older columns like `reportes.zona`, `reportes.sistema`, `reportes.tipo_reporte`, `reportes.qrz_station` (and the `reportes_rs` equivalents) were migrated to `zona_id`, `sistema_id`, `evento_id`, `estacion_id` FKs — see the migration blocks in `main.py` for the backfill pattern (populate the FK, then `DROP COLUMN IF EXISTS` the old string column). Don't reintroduce denormalized string fields for catalog data; use FKs to `Zona`, `Sistema`, `Estacion`, `Evento`.

### Routers (`backend/app/routers/`)
Each domain has its own router mounted under `/api/<prefix>` in `main.py`. Notable ones:
- `public_stats.py` (`/api/public`) — unauthenticated endpoints for the public-facing dashboard/leaderboard; top-10 rankings use `DENSE_RANK()` so tied scores share the same medal position and all ties within the top 10 ranks are shown.
- `reportes_pdf.py` — generates/sends PDF report packages; also invoked by the scheduler (below) and by `admin_db.py`/manual "send now" actions.
- `admin_db.py` — admin-only raw DB operations.
- `libreta.py` / `libreta_rs.py` — per-user RoIP/monitoring config (BrandMeister, AllStarLink, IRLP) and daily log tracking.

### Scheduled report delivery
`main.py` starts an APScheduler `BackgroundScheduler` (America/Mexico_City tz) with a cron job firing every minute (`_run_scheduled_reports`). It matches `ReportePlantillaUserConfig` rows where `prog_activo` + `prog_hora` + `prog_dia_semana` match "now", resolves the date range via `reportes_pdf._resolver_fechas_ultimo_evento`, and calls `reportes_pdf.auto_send`. Per-user overrides of a shared template live in `ReportePlantillaUserConfig` (unique per `plantilla_id`+`usuario_id`); global defaults live on `ReportePlantilla` itself.

### Auth
JWT access + refresh tokens (`app/auth.py`), bcrypt (rounds=12) password hashing, account lockout after 5 failed attempts (15 min), forced password change on first login (`must_change_password`). `get_current_user`/`require_admin` are the standard FastAPI dependencies for protecting routes; roles are `admin`/`operador`.

### Deployment
Pushing to `main` triggers `.github/workflows/deploy.yml`, which SSHes into the production server, does `git reset --hard origin/main`, and rebuilds/restarts via `docker compose -f docker-compose.yml -f docker-compose.prod.yml`. There is no CI test gate — merges to `main` deploy directly to production. Be sure changes are verified before merging to `main`.

### Frontend structure
- `src/api/*.ts` — axios clients per domain, mirroring backend routers.
- `src/store/authStore.ts` — zustand store for auth state.
- `src/pages/gestion/*` — admin CRUD screens for catalogs (Estaciones, Eventos, Zonas, Sistemas, Radioexperimentadores, Usuarios, RedesSociales, ReportesPDF).
- Path alias `@` → `src/` (configured in both `vite.config.ts` and `tsconfig.json`).
- Dev server proxies `/api` to `localhost:8000` (`vite.config.ts`); no env var needed for local API base URL.
