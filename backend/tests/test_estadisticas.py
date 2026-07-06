"""
Regresión del fix de /estadisticas/sistemas-por-evento: el endpoint usaba
r.sistema (columna eliminada en la migración a FKs) en vez de un JOIN contra
sistemas via r.sistema_id, lo que provocaba un 500 en producción.
"""
import uuid
from datetime import datetime

from app import models
from conftest import auth_headers, login


def test_sistemas_por_evento_no_truena_y_agrupa_correctamente(client, admin_user, db_session):
    adm, pw = admin_user
    token = login(client, adm.username, pw)

    evento = models.Evento(tipo=f"TestEvento-{uuid.uuid4().hex[:8]}")
    sistema = models.Sistema(codigo=f"TS{uuid.uuid4().hex[:4]}", nombre="Sistema de prueba")
    db_session.add_all([evento, sistema])
    db_session.commit()
    db_session.refresh(evento)
    db_session.refresh(sistema)

    reportes = [
        models.Reporte(
            indicativo=f"XE1TEST{i}",
            evento_id=evento.id,
            sistema_id=sistema.id,
            fecha_reporte=datetime(2026, 1, 1, 10, 0, 0),
        )
        for i in range(3)
    ]
    db_session.add_all(reportes)
    db_session.commit()

    try:
        resp = client.get(
            "/api/estadisticas/sistemas-por-evento",
            headers=auth_headers(token),
            params={"fecha_inicio": "2026-01-01T00:00:00", "fecha_fin": "2026-01-02T00:00:00"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        match = [r for r in body if r["tipo"] == evento.tipo and r["sistema"] == sistema.codigo]
        assert len(match) == 1, body
        assert match[0]["total"] == 3
    finally:
        for r in reportes:
            db_session.delete(r)
        db_session.delete(evento)
        db_session.delete(sistema)
        db_session.commit()
