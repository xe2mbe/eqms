from fastapi import APIRouter, Depends
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
