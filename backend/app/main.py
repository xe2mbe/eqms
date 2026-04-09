from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging, os

from app.config import settings
from app.database import Base, engine
from app.routers import auth, reportes, usuarios, catalogos, estadisticas, operadores, configuracion, libreta
from app.seeds import seed_prefijos
from app.database import SessionLocal

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("qms")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_prefijos(db)
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


uploads_path = "/app/uploads"
os.makedirs(uploads_path, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.get("/api/health", tags=["Sistema"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
