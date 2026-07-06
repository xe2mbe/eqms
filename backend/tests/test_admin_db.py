"""
Regresión del fix P1 de SQL injection en admin_db.py: restore valida tablas y
columnas contra information_schema antes de interpolarlas; reset_param valida
contra pg_settings antes de ejecutar ALTER SYSTEM RESET.
"""
import gzip
import io
import json
import uuid
from datetime import datetime

from app import models
from conftest import auth_headers, login


def test_restore_rechaza_tabla_desconocida(client, admin_user):
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    payload = json.dumps(
        {"_meta": {}, "tabla_que_no_existe": {"columns": ["id"], "rows": [{"id": 1}]}}
    ).encode("utf-8")

    resp = client.post(
        "/api/admin/db/restore",
        headers=auth_headers(token),
        files={"file": ("evil.json", io.BytesIO(payload), "application/json")},
    )
    assert resp.status_code == 400
    assert "desconocid" in resp.json()["detail"].lower()


def test_restore_rechaza_columna_desconocida(client, admin_user):
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    payload = json.dumps(
        {
            "_meta": {},
            "usuarios": {"columns": ["id", "columna_inventada"], "rows": [{"id": 1, "columna_inventada": "x"}]},
        }
    ).encode("utf-8")

    resp = client.post(
        "/api/admin/db/restore",
        headers=auth_headers(token),
        files={"file": ("evil2.json", io.BytesIO(payload), "application/json")},
    )
    assert resp.status_code == 400
    assert "columna" in resp.json()["detail"].lower()


def test_reset_param_nombre_inventado(client, admin_user):
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    resp = client.post(
        "/api/admin/db/params/reset",
        headers=auth_headers(token),
        json={"name": "work_mem; DROP TABLE usuarios;--"},
    )
    assert resp.status_code == 404


def test_backup_redacta_password_hash(client, admin_user):
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    resp = client.get("/api/admin/db/backup", headers=auth_headers(token))
    assert resp.status_code == 200
    data = json.loads(gzip.decompress(resp.content))
    filas = data.get("usuarios", {}).get("rows", [])
    assert filas, "deberia haber al menos el usuario admin recien creado"
    assert all(f.get("password_hash") is None for f in filas)


def test_backup_restore_columna_jsonb_sobrevive_el_viaje(client, admin_user, db_session):
    """
    Regresion de un bug real: _serialize_row convertia columnas JSONB (dict/list,
    ej. estadisticas_rs.valores) con str(v), que produce el repr de Python
    (comillas simples) en vez de JSON valido. Al restaurar, Postgres rechazaba
    el INSERT con "invalid input syntax for type json". Ahora se usa
    json.dumps(v), que Postgres si puede castear de vuelta a jsonb.
    """
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    plataforma = models.PlataformaRS(nombre=f"TestJsonb-{uuid.uuid4().hex[:8]}")
    db_session.add(plataforma)
    db_session.commit()
    db_session.refresh(plataforma)

    valores_originales = {"me_gusta": 1, "comentarios": 2, "compartidos": 3}
    estadistica = models.EstadisticaRS(
        plataforma_id=plataforma.id,
        valores=valores_originales,
        fecha_reporte=datetime(2026, 1, 1, 10, 0, 0),
        observaciones="Prueba de round-trip JSONB",
    )
    db_session.add(estadistica)
    db_session.commit()
    db_session.refresh(estadistica)
    # refresh() deja una transaccion abierta en esta conexion; el restore hace
    # TRUNCATE (requiere lock exclusivo de tabla) via su propia conexion y se
    # queda esperando indefinidamente si no se cierra esta transaccion antes.
    db_session.commit()

    try:
        backup_resp = client.get("/api/admin/db/backup", headers=auth_headers(token))
        assert backup_resp.status_code == 200
        backup_data = json.loads(gzip.decompress(backup_resp.content))

        # Restaurar solo las dos tablas involucradas (plataformas_rs es FK de estadisticas_rs).
        subset = {
            "_meta": {},
            "plataformas_rs": backup_data["plataformas_rs"],
            "estadisticas_rs": backup_data["estadisticas_rs"],
        }
        payload = json.dumps(subset).encode("utf-8")
        restore_resp = client.post(
            "/api/admin/db/restore",
            headers=auth_headers(token),
            files={"file": ("subset.json", io.BytesIO(payload), "application/json")},
        )
        assert restore_resp.status_code == 200, restore_resp.text

        restaurada = db_session.get(models.EstadisticaRS, estadistica.id)
        assert restaurada is not None
        assert restaurada.valores == valores_originales
    finally:
        # El restore ya truncó y reinsertó; limpiar por id conocido alcanza.
        db_session.query(models.EstadisticaRS).filter(
            models.EstadisticaRS.plataforma_id == plataforma.id
        ).delete()
        db_session.query(models.PlataformaRS).filter(
            models.PlataformaRS.id == plataforma.id
        ).delete()
        db_session.commit()
