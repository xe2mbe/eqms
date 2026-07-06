"""
Regresión del fix P1 de SQL injection en admin_db.py: restore valida tablas y
columnas contra information_schema antes de interpolarlas; reset_param valida
contra pg_settings antes de ejecutar ALTER SYSTEM RESET.
"""
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
    import gzip

    adm, pw = admin_user
    token = login(client, adm.username, pw)

    resp = client.get("/api/admin/db/backup", headers=auth_headers(token))
    assert resp.status_code == 200
    data = json.loads(gzip.decompress(resp.content))
    filas = data.get("usuarios", {}).get("rows", [])
    assert filas, "deberia haber al menos el usuario admin recien creado"
    assert all(f.get("password_hash") is None for f in filas)


def test_restore_no_pierde_datos_por_orden_de_truncate_cascade(client, admin_user, db_session):
    """
    Regresion de un bug real: el restore truncaba e insertaba tabla por tabla
    en un solo loop. Si una tabla "hija" (ej. estadisticas_rs, con FK a
    plataformas_rs) aparece ANTES que su tabla "padre" en el backup, se
    truncaba+insertaba la hija primero, y al truncar la padre despues, el
    TRUNCATE ... CASCADE borraba en cadena los datos ya restaurados de la
    hija -- sin volver a insertarlos. El fix trunca TODAS las tablas primero
    y recien despues inserta todas (con session_replication_role='replica'
    el orden de los INSERT no afecta la validez de las FK).
    """
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    plataforma = models.PlataformaRS(nombre=f"TestOrden-{uuid.uuid4().hex[:8]}")
    db_session.add(plataforma)
    db_session.commit()
    db_session.refresh(plataforma)
    db_session.commit()

    estadistica = models.EstadisticaRS(
        plataforma_id=plataforma.id,
        valores={"me_gusta": 5},
        fecha_reporte=datetime(2026, 1, 1, 10, 0, 0),
    )
    db_session.add(estadistica)
    db_session.commit()
    db_session.refresh(estadistica)
    db_session.commit()

    try:
        backup_resp = client.get("/api/admin/db/backup", headers=auth_headers(token))
        assert backup_resp.status_code == 200
        import gzip
        backup_data = json.loads(gzip.decompress(backup_resp.content))

        # Orden deliberado: la tabla hija (estadisticas_rs) antes que la padre
        # (plataformas_rs) -- el orden que exponia el bug.
        subset = {
            "_meta": {},
            "estadisticas_rs": backup_data["estadisticas_rs"],
            "plataformas_rs": backup_data["plataformas_rs"],
        }
        payload = json.dumps(subset).encode("utf-8")
        restore_resp = client.post(
            "/api/admin/db/restore",
            headers=auth_headers(token),
            files={"file": ("subset.json", io.BytesIO(payload), "application/json")},
        )
        assert restore_resp.status_code == 200, restore_resp.text

        restaurada = db_session.get(models.EstadisticaRS, estadistica.id)
        assert restaurada is not None, "estadisticas_rs quedo vacia: el CASCADE de plataformas_rs la borro"
        assert restaurada.valores == {"me_gusta": 5}
    finally:
        db_session.query(models.EstadisticaRS).filter(
            models.EstadisticaRS.plataforma_id == plataforma.id
        ).delete()
        db_session.query(models.PlataformaRS).filter(
            models.PlataformaRS.id == plataforma.id
        ).delete()
        db_session.commit()
