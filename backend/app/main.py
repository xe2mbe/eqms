from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging, os

from app.config import settings
from app.database import Base, engine
from app.routers import auth, reportes, usuarios, catalogos, estadisticas, operadores, configuracion, libreta, admin_db, premios, libreta_rs
from app.seeds import seed_prefijos, seed_metricas_rs_default
from app.database import SessionLocal
from sqlalchemy import text

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("qms")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    Base.metadata.create_all(bind=engine)

    # Migraciones sin Alembic
    with engine.connect() as conn:
        # estadisticas_rs: columnas fijas → JSONB
        conn.execute(text(
            "ALTER TABLE estadisticas_rs ADD COLUMN IF NOT EXISTS valores JSONB DEFAULT '{}'::jsonb"
        ))
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'estadisticas_rs' AND column_name = 'me_gusta'
                ) THEN
                    UPDATE estadisticas_rs
                    SET valores = json_build_object(
                        'me_gusta',       COALESCE(me_gusta, 0),
                        'comentarios',    COALESCE(comentarios, 0),
                        'compartidos',    COALESCE(compartidos, 0),
                        'reproducciones', COALESCE(reproducciones, 0)
                    )::jsonb
                    WHERE valores = '{}'::jsonb OR valores IS NULL;
                END IF;
            END $$;
        """))
        # reportes_rs: nuevos campos compatibles con tabla reportes
        conn.execute(text("ALTER TABLE reportes_rs ADD COLUMN IF NOT EXISTS senal INTEGER DEFAULT 59"))
        conn.execute(text("ALTER TABLE reportes_rs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ"))
        conn.execute(text("ALTER TABLE plataformas_rs ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#1677ff'"))

        # FK migration: reportes
        conn.execute(text("ALTER TABLE reportes ADD COLUMN IF NOT EXISTS zona_id INTEGER REFERENCES zonas(id)"))
        conn.execute(text("ALTER TABLE reportes ADD COLUMN IF NOT EXISTS sistema_id INTEGER REFERENCES sistemas(id)"))
        conn.execute(text("ALTER TABLE reportes ADD COLUMN IF NOT EXISTS estacion_id INTEGER REFERENCES estaciones(id)"))
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'reportes' AND column_name = 'zona'
                ) THEN
                    UPDATE reportes r SET zona_id = z.id
                    FROM zonas z WHERE r.zona = z.codigo AND r.zona_id IS NULL;
                    UPDATE reportes r SET sistema_id = s.id
                    FROM sistemas s WHERE r.sistema = s.codigo AND r.sistema_id IS NULL;
                    UPDATE reportes r SET sistema_id = s.id
                    FROM sistemas s WHERE UPPER(r.sistema) = UPPER(s.codigo) AND r.sistema_id IS NULL;
                    UPDATE reportes r SET estacion_id = e.id
                    FROM estaciones e WHERE r.qrz_station = e.qrz AND r.estacion_id IS NULL;
                    UPDATE reportes r SET evento_id = e.id
                    FROM eventos e WHERE r.tipo_reporte = e.tipo AND r.evento_id IS NULL;
                END IF;
            END $$;
        """))
        conn.execute(text("ALTER TABLE reportes DROP COLUMN IF EXISTS zona"))
        conn.execute(text("ALTER TABLE reportes DROP COLUMN IF EXISTS sistema"))
        conn.execute(text("ALTER TABLE reportes DROP COLUMN IF EXISTS tipo_reporte"))
        conn.execute(text("ALTER TABLE reportes DROP COLUMN IF EXISTS qrz_station"))

        # FK migration: reportes_rs
        conn.execute(text("ALTER TABLE reportes_rs ADD COLUMN IF NOT EXISTS zona_id INTEGER REFERENCES zonas(id)"))
        conn.execute(text("ALTER TABLE reportes_rs ADD COLUMN IF NOT EXISTS estacion_id INTEGER REFERENCES estaciones(id)"))
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'reportes_rs' AND column_name = 'zona'
                ) THEN
                    UPDATE reportes_rs r SET zona_id = z.id
                    FROM zonas z WHERE r.zona = z.codigo AND r.zona_id IS NULL;
                    UPDATE reportes_rs r SET estacion_id = e.id
                    FROM estaciones e WHERE r.qrz_station = e.qrz AND r.estacion_id IS NULL;
                    UPDATE reportes_rs r SET evento_id = e.id
                    FROM eventos e WHERE r.tipo_reporte = e.tipo AND r.evento_id IS NULL;
                END IF;
            END $$;
        """))
        conn.execute(text("ALTER TABLE reportes_rs DROP COLUMN IF EXISTS zona"))
        conn.execute(text("ALTER TABLE reportes_rs DROP COLUMN IF EXISTS tipo_reporte"))
        conn.execute(text("ALTER TABLE reportes_rs DROP COLUMN IF EXISTS qrz_station"))

        conn.commit()

    db = SessionLocal()
    try:
        seed_prefijos(db)
        seed_metricas_rs_default(db)
    finally:
        db.close()
    yield
    logger.info("Servidor detenido.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API REST para el Sistema de Gestión de QSO – FMRE",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,         prefix="/api/auth",         tags=["Autenticación"])
app.include_router(reportes.router,     prefix="/api/reportes",     tags=["Reportes"])
app.include_router(usuarios.router,     prefix="/api/usuarios",     tags=["Usuarios"])
app.include_router(catalogos.router,    prefix="/api/catalogos",    tags=["Catálogos"])
app.include_router(estadisticas.router, prefix="/api/estadisticas", tags=["Estadísticas"])
app.include_router(operadores.router,     prefix="/api/operadores",     tags=["Operadores"])
app.include_router(configuracion.router, prefix="/api/configuracion", tags=["Configuración"])
app.include_router(libreta.router,      prefix="/api/libreta",      tags=["Libreta"])
app.include_router(admin_db.router,     prefix="/api/admin/db",     tags=["Admin DB"])
app.include_router(premios.router,      prefix="/api/premios",       tags=["Premios"])
app.include_router(libreta_rs.router,   prefix="/api/libreta-rs",    tags=["Libreta RS"])


uploads_path = "/app/uploads"
os.makedirs(uploads_path, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.get("/api/health", tags=["Sistema"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
