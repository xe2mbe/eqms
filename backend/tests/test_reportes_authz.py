"""
Regresión del fix P1 de autorización owner-or-admin en reportes RF
(backend/app/routers/reportes.py:_require_owner_or_admin).
"""
import uuid

from app import models
from conftest import auth_headers, login


def test_reporte_solo_dueno_o_admin_puede_editar_o_borrar(client, operador_user, otro_operador_user, admin_user):
    op1, pw1 = operador_user
    op2, pw2 = otro_operador_user
    adm, pwa = admin_user

    token_op1 = login(client, op1.username, pw1)
    token_op2 = login(client, op2.username, pw2)
    token_admin = login(client, adm.username, pwa)

    create_resp = client.post(
        "/api/reportes",
        headers=auth_headers(token_op1),
        json={"indicativo": "XE1TESTCI", "fecha_reporte": "2026-01-01T10:00:00"},
    )
    assert create_resp.status_code == 201, create_resp.text
    reporte_id = create_resp.json()["id"]

    try:
        # Un operador que no capturo el reporte no puede editarlo ni borrarlo.
        resp = client.put(
            f"/api/reportes/{reporte_id}", headers=auth_headers(token_op2), json={"observaciones": "hackeado"}
        )
        assert resp.status_code == 403

        resp = client.delete(f"/api/reportes/{reporte_id}", headers=auth_headers(token_op2))
        assert resp.status_code == 403

        # El dueno si puede editar el suyo.
        resp = client.put(
            f"/api/reportes/{reporte_id}", headers=auth_headers(token_op1), json={"observaciones": "editado por dueno"}
        )
        assert resp.status_code == 200, resp.text

        # Un admin puede editar cualquier reporte, sea o no el dueno.
        resp = client.put(
            f"/api/reportes/{reporte_id}", headers=auth_headers(token_admin), json={"observaciones": "editado por admin"}
        )
        assert resp.status_code == 200, resp.text
    finally:
        # Limpieza idempotente: si ya se borro en el test, el 404 no rompe la limpieza.
        client.delete(f"/api/reportes/{reporte_id}", headers=auth_headers(token_admin))


def test_reporte_rs_solo_dueno_o_admin_puede_editar_o_borrar(
    client, operador_user, otro_operador_user, admin_user, db_session
):
    op1, pw1 = operador_user
    op2, pw2 = otro_operador_user
    adm, pwa = admin_user

    token_op1 = login(client, op1.username, pw1)
    token_op2 = login(client, op2.username, pw2)
    token_admin = login(client, adm.username, pwa)

    # main.py no siembra plataformas_rs en el arranque (solo el script manual
    # app/utils/seed.py), asi que en una BD de test limpia no hay ninguna: se crea una propia.
    plataforma = models.PlataformaRS(nombre=f"TestPlataforma-{uuid.uuid4().hex[:8]}")
    db_session.add(plataforma)
    db_session.commit()
    db_session.refresh(plataforma)
    plataforma_id = plataforma.id

    create_resp = client.post(
        "/api/libreta-rs/reportes",
        headers=auth_headers(token_op1),
        json={
            "indicativo": "XE1RSTESTCI",
            "plataforma_id": plataforma_id,
            "fecha_reporte": "2026-01-01T10:00:00",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    rs_id = create_resp.json()["id"]
    body_edicion = {
        "indicativo": "XE1RSTESTCI",
        "plataforma_id": plataforma_id,
        "fecha_reporte": "2026-01-01T10:00:00",
        "observaciones": "edicion",
    }

    try:
        resp = client.put(f"/api/libreta-rs/reportes/{rs_id}", headers=auth_headers(token_op2), json=body_edicion)
        assert resp.status_code == 403

        resp = client.delete(f"/api/libreta-rs/reportes/{rs_id}", headers=auth_headers(token_op2))
        assert resp.status_code == 403

        resp = client.put(f"/api/libreta-rs/reportes/{rs_id}", headers=auth_headers(token_op1), json=body_edicion)
        assert resp.status_code == 200, resp.text
    finally:
        client.delete(f"/api/libreta-rs/reportes/{rs_id}", headers=auth_headers(token_admin))
        db_session.delete(plataforma)
        db_session.commit()
