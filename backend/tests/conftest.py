"""
Fixtures compartidos para la suite de tests del backend.

Estas variables de entorno se fijan ANTES de importar app.main / app.config,
para que Settings() las tome al arrancar: apuntar a una BD de pruebas (nunca la
de desarrollo/producción) y una SECRET_KEY que no dispare el validador de
config.py (que exige >=32 chars y que no sea uno de los placeholders conocidos
cuando DEBUG=false).
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql://quser:qpassword@localhost:5432/qmsdb_test")
os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-solo-para-testing-1234567890")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

import uuid  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app import models  # noqa: E402
from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """TestClient como context manager: dispara el lifespan de main.py (migra el
    esquema contra la BD de pruebas) una sola vez para toda la sesión de tests."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _crear_usuario(db, role: str, password: str = "Test2026!", must_change_password: bool = False):
    username = f"test_{role}_{uuid.uuid4().hex[:8]}"
    user = models.Usuario(
        username=username,
        password_hash=hash_password(password),
        full_name=f"Usuario de prueba ({role})",
        role=role,
        must_change_password=must_change_password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, password


@pytest.fixture
def admin_user(db_session):
    user, password = _crear_usuario(db_session, "admin")
    yield user, password
    db_session.delete(user)
    db_session.commit()


@pytest.fixture
def operador_user(db_session):
    user, password = _crear_usuario(db_session, "operador")
    yield user, password
    db_session.delete(user)
    db_session.commit()


@pytest.fixture
def otro_operador_user(db_session):
    user, password = _crear_usuario(db_session, "operador")
    yield user, password
    db_session.delete(user)
    db_session.commit()


def login(client, username: str, password: str) -> str:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
