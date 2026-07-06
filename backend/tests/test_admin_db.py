"""
Regresión del fix P1 de SQL injection en admin_db.py: restore valida tablas y
columnas contra information_schema antes de interpolarlas; reset_param valida
contra pg_settings antes de ejecutar ALTER SYSTEM RESET.
"""
import io
import json

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
