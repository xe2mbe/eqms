"""
Regresión de los fixes de auth del P1 (backend/app/routers/auth.py):
- change-password ahora exige la contraseña actual, salvo en el cambio forzado
  del primer login (must_change_password=True).
"""
import uuid

from app import models
from app.auth import hash_password
from conftest import auth_headers, login


def test_login_credenciales_correctas(client, operador_user):
    user, password = operador_user
    resp = client.post("/api/auth/login", json={"username": user.username, "password": password})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body
    assert body["user"]["username"] == user.username


def test_login_credenciales_incorrectas(client, operador_user):
    user, _ = operador_user
    resp = client.post("/api/auth/login", json={"username": user.username, "password": "clave-incorrecta"})
    assert resp.status_code == 401


def test_change_password_primer_login_no_requiere_current_password(client, db_session):
    username = f"test_firstlogin_{uuid.uuid4().hex[:8]}"
    password = "Original2026!"
    user = models.Usuario(
        username=username,
        password_hash=hash_password(password),
        full_name="Primer login",
        role="operador",
        must_change_password=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    try:
        token = login(client, username, password)
        resp = client.post(
            "/api/auth/change-password",
            headers=auth_headers(token),
            json={"new_password": "Nueva2026!", "confirm_password": "Nueva2026!"},
        )
        assert resp.status_code == 200, resp.text
    finally:
        db_session.delete(user)
        db_session.commit()


def test_change_password_voluntario_requiere_current_password_correcta(client, operador_user):
    user, password = operador_user
    token = login(client, user.username, password)

    resp = client.post(
        "/api/auth/change-password",
        headers=auth_headers(token),
        json={
            "current_password": "clave-incorrecta",
            "new_password": "Otra2026!",
            "confirm_password": "Otra2026!",
        },
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/auth/change-password",
        headers=auth_headers(token),
        json={
            "current_password": password,
            "new_password": "Otra2026!",
            "confirm_password": "Otra2026!",
        },
    )
    assert resp.status_code == 200, resp.text
