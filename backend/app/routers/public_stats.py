from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter()


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Estadísticas públicas del sistema — sin autenticación."""

    rf_total = db.execute(text("SELECT COUNT(*) FROM reportes")).scalar() or 0
    rf_indicativos = db.execute(text("SELECT COUNT(DISTINCT indicativo) FROM reportes")).scalar() or 0

    rs_total = db.execute(text("SELECT COUNT(*) FROM reportes_rs")).scalar() or 0
    rs_indicativos = db.execute(text("SELECT COUNT(DISTINCT indicativo) FROM reportes_rs")).scalar() or 0

    por_estado = db.execute(text("""
        SELECT estado, COUNT(*) as total FROM reportes
        WHERE estado IS NOT NULL AND estado != '' AND estado != 'Extranjero'
        GROUP BY estado ORDER BY total DESC
    """)).fetchall()

    por_sistema = db.execute(text("""
        SELECT s.codigo, s.nombre, COUNT(*) as total
        FROM reportes r JOIN sistemas s ON s.id = r.sistema_id
        WHERE r.sistema_id IS NOT NULL
        GROUP BY s.codigo, s.nombre ORDER BY total DESC
    """)).fetchall()

    tendencia = db.execute(text("""
        SELECT TO_CHAR(DATE_TRUNC('month', fecha_reporte), 'YYYY-MM') as mes,
               COUNT(*) as total
        FROM reportes
        WHERE fecha_reporte >= NOW() - INTERVAL '12 months'
        GROUP BY mes ORDER BY mes
    """)).fetchall()

    top_rf = db.execute(text("""
        SELECT r.indicativo, MAX(re.nombre_completo) as nombre, COUNT(*) as total
        FROM reportes r
        LEFT JOIN radioexperimentadores re ON re.indicativo = r.indicativo
        WHERE UPPER(r.indicativo) NOT LIKE '%SWL%'
        GROUP BY r.indicativo ORDER BY total DESC LIMIT 10
    """)).fetchall()

    por_plataforma = db.execute(text("""
        SELECT p.nombre, COUNT(*) as total
        FROM reportes_rs r JOIN plataformas_rs p ON p.id = r.plataforma_id
        GROUP BY p.nombre ORDER BY total DESC
    """)).fetchall()

    top_rs = db.execute(text("""
        SELECT r.indicativo, MAX(re.nombre_completo) as nombre, COUNT(*) as total
        FROM reportes_rs r
        LEFT JOIN radioexperimentadores re ON re.indicativo = r.indicativo
        GROUP BY r.indicativo ORDER BY total DESC LIMIT 10
    """)).fetchall()

    ultimo_evento = db.execute(text("""
        SELECT e.tipo, DATE_TRUNC('day', MAX(r.fecha_reporte)) as ultima,
               COUNT(DISTINCT r.indicativo) as participantes
        FROM reportes r JOIN eventos e ON e.id = r.evento_id
        WHERE r.fecha_reporte >= NOW() - INTERVAL '30 days'
        GROUP BY e.tipo ORDER BY ultima DESC LIMIT 1
    """)).first()

    paises = db.execute(text("""
        SELECT pais, COUNT(DISTINCT indicativo) as indicativos
        FROM reportes
        WHERE pais IS NOT NULL AND pais != '' AND pais != 'México'
        GROUP BY pais ORDER BY indicativos DESC LIMIT 8
    """)).fetchall()

    return {
        "rf": {
            "total": int(rf_total),
            "indicativos": int(rf_indicativos),
            "por_estado": [{"estado": r[0], "total": int(r[1])} for r in por_estado],
            "por_sistema": [{"sistema": r[0], "nombre": r[1], "total": int(r[2])} for r in por_sistema],
            "tendencia": [{"mes": r[0], "total": int(r[1])} for r in tendencia],
            "top_indicativos": [{"indicativo": r[0], "nombre": r[1], "total": int(r[2])} for r in top_rf],
            "paises": [{"pais": r[0], "indicativos": int(r[1])} for r in paises],
        },
        "rs": {
            "total": int(rs_total),
            "indicativos": int(rs_indicativos),
            "por_plataforma": [{"plataforma": r[0], "total": int(r[1])} for r in por_plataforma],
            "top_indicativos": [{"indicativo": r[0], "nombre": r[1], "total": int(r[2])} for r in top_rs],
        },
        "ultimo_evento": {
            "tipo": ultimo_evento[0],
            "ultima": str(ultimo_evento[1])[:10],
            "participantes": int(ultimo_evento[2]),
        } if ultimo_evento else None,
    }


@router.get("/estaciones-rf")
def estaciones_rf(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT r.indicativo, MAX(re.nombre_completo) as nombre, COUNT(*) as total,
               TO_CHAR(MAX(r.fecha_reporte), 'YYYY-MM-DD') as ultima
        FROM reportes r
        LEFT JOIN radioexperimentadores re ON re.indicativo = r.indicativo
        GROUP BY r.indicativo ORDER BY total DESC
    """)).fetchall()
    return [{"indicativo": r[0], "nombre": r[1], "total": int(r[2]), "ultima": r[3]} for r in rows]


@router.get("/estaciones-rs")
def estaciones_rs(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT r.indicativo, MAX(re.nombre_completo) as nombre, COUNT(*) as total,
               TO_CHAR(MAX(r.fecha_reporte), 'YYYY-MM-DD') as ultima
        FROM reportes_rs r
        LEFT JOIN radioexperimentadores re ON re.indicativo = r.indicativo
        GROUP BY r.indicativo ORDER BY total DESC
    """)).fetchall()
    return [{"indicativo": r[0], "nombre": r[1], "total": int(r[2]), "ultima": r[3]} for r in rows]


@router.get("/ultimo-evento-participantes")
def ultimo_evento_participantes(db: Session = Depends(get_db)):
    ultimo = db.execute(text("""
        SELECT e.tipo, DATE_TRUNC('day', MAX(r.fecha_reporte))::date AS fecha
        FROM reportes r JOIN eventos e ON e.id = r.evento_id
        WHERE r.fecha_reporte >= NOW() - INTERVAL '30 days'
        GROUP BY e.tipo ORDER BY fecha DESC LIMIT 1
    """)).first()
    if not ultimo:
        return {"evento": None, "fecha": None, "participantes": []}
    rows = db.execute(text("""
        SELECT r.indicativo, MAX(re.nombre_completo) as nombre, COUNT(*) as total
        FROM reportes r
        JOIN eventos e ON e.id = r.evento_id
        LEFT JOIN radioexperimentadores re ON re.indicativo = r.indicativo
        WHERE e.tipo = :tipo AND DATE_TRUNC('day', r.fecha_reporte) = :fecha
        GROUP BY r.indicativo ORDER BY total DESC
    """), {"tipo": ultimo[0], "fecha": str(ultimo[1])}).fetchall()
    return {
        "evento": ultimo[0],
        "fecha": str(ultimo[1]),
        "participantes": [{"indicativo": r[0], "nombre": r[1], "total": int(r[2])} for r in rows],
    }


@router.get("/buscar")
def buscar_indicativo(
    indicativo: str = Query(..., min_length=2, max_length=20),
    db: Session = Depends(get_db),
):
    """Búsqueda pública de reportes por indicativo."""
    ind = indicativo.strip().upper()

    # Datos del operador
    operador = db.execute(text("""
        SELECT nombre_completo, municipio, estado, tipo_licencia
        FROM radioexperimentadores WHERE UPPER(indicativo) = :ind LIMIT 1
    """), {"ind": ind}).first()

    # Resumen RF
    rf_resumen = db.execute(text("""
        SELECT COUNT(*) as total,
               MIN(fecha_reporte) as primera,
               MAX(fecha_reporte) as ultima
        FROM reportes WHERE UPPER(indicativo) = :ind
    """), {"ind": ind}).first()

    # RF por evento
    rf_por_evento = db.execute(text("""
        SELECT e.tipo, COUNT(*) as total
        FROM reportes r LEFT JOIN eventos e ON e.id = r.evento_id
        WHERE UPPER(r.indicativo) = :ind
        GROUP BY e.tipo ORDER BY total DESC
    """), {"ind": ind}).fetchall()

    # RF por sistema
    rf_por_sistema = db.execute(text("""
        SELECT s.codigo, COUNT(*) as total
        FROM reportes r LEFT JOIN sistemas s ON s.id = r.sistema_id
        WHERE UPPER(r.indicativo) = :ind AND r.sistema_id IS NOT NULL
        GROUP BY s.codigo ORDER BY total DESC
    """), {"ind": ind}).fetchall()

    # Últimos 10 registros RF
    rf_ultimos = db.execute(text("""
        SELECT r.fecha_reporte, e.tipo as evento, s.codigo as sistema,
               z.nombre as zona, r.ciudad, r.estado, r.senal
        FROM reportes r
        LEFT JOIN eventos e ON e.id = r.evento_id
        LEFT JOIN sistemas s ON s.id = r.sistema_id
        LEFT JOIN zonas z ON z.id = r.zona_id
        WHERE UPPER(r.indicativo) = :ind
        ORDER BY r.fecha_reporte DESC LIMIT 10
    """), {"ind": ind}).fetchall()

    # Resumen RS
    rs_resumen = db.execute(text("""
        SELECT COUNT(*) as total,
               MIN(fecha_reporte) as primera,
               MAX(fecha_reporte) as ultima
        FROM reportes_rs WHERE UPPER(indicativo) = :ind
    """), {"ind": ind}).first()

    # RS por plataforma
    rs_por_plataforma = db.execute(text("""
        SELECT p.nombre, COUNT(*) as total
        FROM reportes_rs r JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE UPPER(r.indicativo) = :ind
        GROUP BY p.nombre ORDER BY total DESC
    """), {"ind": ind}).fetchall()

    # Últimos 10 registros RS
    rs_ultimos = db.execute(text("""
        SELECT r.fecha_reporte, p.nombre as plataforma, r.ciudad, r.estado, r.senal
        FROM reportes_rs r JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE UPPER(r.indicativo) = :ind
        ORDER BY r.fecha_reporte DESC LIMIT 10
    """), {"ind": ind}).fetchall()

    if (rf_resumen[0] or 0) == 0 and (rs_resumen[0] or 0) == 0:
        raise HTTPException(404, f"No se encontraron registros para {ind}")

    def fmt_date(d):
        return str(d)[:10] if d else None

    return {
        "indicativo": ind,
        "operador": {
            "nombre": operador[0] if operador else None,
            "municipio": operador[1] if operador else None,
            "estado": operador[2] if operador else None,
            "licencia": operador[3] if operador else None,
        } if operador else None,
        "rf": {
            "total": int(rf_resumen[0] or 0),
            "primera": fmt_date(rf_resumen[1]),
            "ultima": fmt_date(rf_resumen[2]),
            "por_evento": [{"evento": r[0] or "—", "total": int(r[1])} for r in rf_por_evento],
            "por_sistema": [{"sistema": r[0], "total": int(r[1])} for r in rf_por_sistema],
            "ultimos": [{
                "fecha": fmt_date(r[0]), "evento": r[1], "sistema": r[2],
                "zona": r[3], "ciudad": r[4], "estado": r[5], "senal": r[6],
            } for r in rf_ultimos],
        },
        "rs": {
            "total": int(rs_resumen[0] or 0),
            "primera": fmt_date(rs_resumen[1]),
            "ultima": fmt_date(rs_resumen[2]),
            "por_plataforma": [{"plataforma": r[0], "total": int(r[1])} for r in rs_por_plataforma],
            "ultimos": [{
                "fecha": fmt_date(r[0]), "plataforma": r[1],
                "ciudad": r[2], "estado": r[3], "senal": r[4],
            } for r in rs_ultimos],
        },
    }
