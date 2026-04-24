from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from datetime import datetime

from app.database import get_db
from app import models, schemas

router = APIRouter()


def _fin(fecha_fin: Optional[datetime]) -> Optional[datetime]:
    """Si llega solo fecha (sin hora), extiende a 23:59:59 para incluir todo ese día."""
    if fecha_fin and not (fecha_fin.hour or fecha_fin.minute or fecha_fin.second):
        return fecha_fin.replace(hour=23, minute=59, second=59)
    return fecha_fin


@router.get("/resumen", response_model=schemas.EstadisticaResumen)
def resumen(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    q = db.query(models.Reporte)
    if fecha_inicio:
        q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        fin = fecha_fin if fecha_fin.hour or fecha_fin.minute else fecha_fin.replace(hour=23, minute=59, second=59)
        q = q.filter(models.Reporte.fecha_reporte <= fin)
    if evento_id:
        q = q.filter(models.Reporte.evento_id == evento_id)

    total = q.count()
    # Operadores = usuarios del sistema que capturaron reportes
    operadores = q.with_entities(func.count(func.distinct(models.Reporte.capturado_por))).scalar() or 0
    # Estaciones = indicativos distintos reportados
    estaciones = q.with_entities(func.count(func.distinct(models.Reporte.indicativo))).scalar() or 0

    estados = (
        q.with_entities(models.Reporte.estado, func.count().label("total"))
        .filter(models.Reporte.estado != None)
        .group_by(models.Reporte.estado)
        .order_by(func.count().desc())
        .all()
    )

    sistemas = (
        q.with_entities(models.Reporte.sistema, func.count().label("total"))
        .filter(models.Reporte.sistema != None)
        .group_by(models.Reporte.sistema)
        .order_by(func.count().desc())
        .all()
    )

    eventos = (
        q.with_entities(models.Reporte.tipo_reporte, func.count().label("total"))
        .filter(models.Reporte.tipo_reporte != None)
        .group_by(models.Reporte.tipo_reporte)
        .order_by(func.count().desc())
        .all()
    )

    return schemas.EstadisticaResumen(
        total_reportes=total,
        total_operadores=operadores,
        total_estaciones=estaciones,
        estados=[{"estado": e, "total": t} for e, t in estados if e],
        sistemas=[{"sistema": s, "total": t} for s, t in sistemas if s],
        eventos=[{"evento": ev, "total": t} for ev, t in eventos if ev],
    )


@router.get("/por-estado")
def por_estado(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Reporte.estado, func.count().label("total")).filter(models.Reporte.estado != None)
    if fecha_inicio: q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:    q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)
    if evento_id:    q = q.filter(models.Reporte.evento_id == evento_id)
    rows = q.group_by(models.Reporte.estado).order_by(func.count().desc()).all()
    return [{"estado": e, "total": t} for e, t in rows]


@router.get("/por-sistema")
def por_sistema(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Reporte.sistema, func.count().label("total")).filter(models.Reporte.sistema != None)
    if fecha_inicio: q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:    q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)
    if evento_id:    q = q.filter(models.Reporte.evento_id == evento_id)
    rows = q.group_by(models.Reporte.sistema).order_by(func.count().desc()).all()
    return [{"sistema": s, "total": t} for s, t in rows]


@router.get("/tendencia")
def tendencia(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    granularidad: str = Query("dia", pattern="^(dia|semana|mes)$"),
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if granularidad == "mes":
        trunc = func.date_trunc("month", models.Reporte.fecha_reporte)
    elif granularidad == "semana":
        trunc = func.date_trunc("week", models.Reporte.fecha_reporte)
    else:
        trunc = func.date_trunc("day", models.Reporte.fecha_reporte)
    q = db.query(trunc.label("periodo"), func.count().label("total"))
    if fecha_inicio: q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:    q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)
    if evento_id:    q = q.filter(models.Reporte.evento_id == evento_id)
    rows = q.group_by("periodo").order_by("periodo").all()
    return [{"periodo": str(p), "total": t} for p, t in rows]


@router.get("/rs/resumen-reportes")
def rs_resumen_reportes(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Estadísticas de estaciones reportadas vía redes sociales."""
    fi, ff = fecha_inicio, _fin(fecha_fin)
    total = db.execute(text("""
        SELECT COUNT(*) FROM reportes_rs
        WHERE (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
    """), {"fi": fi, "ff": ff}).scalar() or 0

    indicativos = db.execute(text("""
        SELECT COUNT(DISTINCT indicativo) FROM reportes_rs
        WHERE (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
    """), {"fi": fi, "ff": ff}).scalar() or 0

    estados = db.execute(text("""
        SELECT COUNT(DISTINCT estado) FROM reportes_rs
        WHERE estado IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
    """), {"fi": fi, "ff": ff}).scalar() or 0

    por_plataforma = db.execute(text("""
        SELECT p.nombre, COUNT(r.id) AS total
        FROM reportes_rs r
        JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE (:fi IS NULL OR r.fecha_reporte >= :fi)
          AND (:ff IS NULL OR r.fecha_reporte <= :ff)
        GROUP BY p.nombre ORDER BY total DESC
    """), {"fi": fi, "ff": ff}).fetchall()

    por_estado = db.execute(text("""
        SELECT estado, COUNT(*) AS total
        FROM reportes_rs
        WHERE estado IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
        GROUP BY estado ORDER BY total DESC LIMIT 15
    """), {"fi": fi, "ff": ff}).fetchall()

    return {
        "total_reportes": int(total),
        "total_indicativos": int(indicativos),
        "total_estados": int(estados),
        "por_plataforma": [{"plataforma": r[0], "total": r[1]} for r in por_plataforma],
        "por_estado": [{"estado": r[0], "total": r[1]} for r in por_estado],
    }


@router.get("/rs/resumen")
def rs_resumen(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Agrega métricas JSONB por plataforma: {plataforma, slug, total}[]"""
    ff = _fin(fecha_fin)
    rows = db.execute(text("""
        SELECT p.nombre AS plataforma, p.color, kv.key AS slug,
               SUM((e.valores ->> kv.key)::numeric) AS total
        FROM estadisticas_rs e
        JOIN plataformas_rs p ON p.id = e.plataforma_id
        CROSS JOIN LATERAL jsonb_each_text(e.valores) AS kv
        WHERE (:fi IS NULL OR e.fecha_reporte >= :fi)
          AND (:ff IS NULL OR e.fecha_reporte <= :ff)
        GROUP BY p.nombre, p.color, kv.key
        ORDER BY p.nombre, total DESC
    """), {"fi": fecha_inicio, "ff": ff}).fetchall()
    return [
        {"plataforma": r[0], "color": r[1], "slug": r[2], "total": float(r[3] or 0)}
        for r in rows
    ]


@router.get("/rs/tendencia")
def rs_tendencia(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    granularidad: str = Query("dia", pattern="^(dia|semana|mes)$"),
    db: Session = Depends(get_db),
):
    trunc = {"dia": "day", "semana": "week", "mes": "month"}[granularidad]
    ff = _fin(fecha_fin)
    rows = db.execute(text(f"""
        SELECT DATE_TRUNC('{trunc}', r.fecha_reporte) AS periodo,
               p.nombre AS plataforma, COUNT(*) AS total
        FROM reportes_rs r
        JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE (:fi IS NULL OR r.fecha_reporte >= :fi)
          AND (:ff IS NULL OR r.fecha_reporte <= :ff)
        GROUP BY periodo, p.nombre ORDER BY periodo, p.nombre
    """), {"fi": fecha_inicio, "ff": ff}).fetchall()
    return [{"periodo": str(r[0]), "plataforma": r[1], "total": r[2]} for r in rows]


@router.get("/rs/por-estado")
def rs_por_estado(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT estado, COUNT(*) AS total FROM reportes_rs
        WHERE estado IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
        GROUP BY estado ORDER BY total DESC LIMIT 15
    """), {"fi": fecha_inicio, "ff": _fin(fecha_fin)}).fetchall()
    return [{"estado": r[0], "total": r[1]} for r in rows]


@router.get("/rs/top-indicativos")
def rs_top_indicativos(
    limite: int = 20,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT p.nombre AS plataforma, r.indicativo,
               COUNT(*) AS total,
               COUNT(DISTINCT r.estado) AS estados,
               COUNT(DISTINCT r.zona)   AS zonas,
               MAX(r.fecha_reporte)     AS ultimo,
               rx.nombre_completo
        FROM reportes_rs r
        JOIN plataformas_rs p ON p.id = r.plataforma_id
        LEFT JOIN radioexperimentadores rx ON rx.indicativo = r.indicativo
        WHERE (:fi IS NULL OR r.fecha_reporte >= :fi)
          AND (:ff IS NULL OR r.fecha_reporte <= :ff)
        GROUP BY p.nombre, r.indicativo, rx.nombre_completo
        ORDER BY p.nombre, total DESC
    """), {"fi": fecha_inicio, "ff": _fin(fecha_fin)}).fetchall()
    return [
        {"plataforma": r[0], "indicativo": r[1], "total": r[2],
         "estados": r[3], "zonas": r[4],
         "ultimo": str(r[5]) if r[5] else None, "nombre": r[6]}
        for r in rows
    ]


@router.get("/rs/zona-actividad")
def rs_zona_actividad(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT p.nombre AS plataforma, r.zona,
               COUNT(*) AS total,
               COUNT(DISTINCT r.indicativo) AS indicativos
        FROM reportes_rs r
        JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE r.zona IS NOT NULL
          AND (:fi IS NULL OR r.fecha_reporte >= :fi)
          AND (:ff IS NULL OR r.fecha_reporte <= :ff)
        GROUP BY p.nombre, r.zona ORDER BY p.nombre, total DESC
    """), {"fi": fecha_inicio, "ff": _fin(fecha_fin)}).fetchall()
    return [{"plataforma": r[0], "zona": r[1], "total": r[2], "indicativos": r[3]} for r in rows]


@router.get("/rs/nuevos-mensuales")
def rs_nuevos_mensuales(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        WITH primera AS (
            SELECT r.indicativo, p.nombre AS plataforma,
                   MIN(r.fecha_reporte) AS primera_vez
            FROM reportes_rs r
            JOIN plataformas_rs p ON p.id = r.plataforma_id
            GROUP BY r.indicativo, p.nombre
        )
        SELECT DATE_TRUNC('month', primera_vez) AS mes,
               plataforma, COUNT(*) AS nuevos
        FROM primera GROUP BY mes, plataforma ORDER BY mes, plataforma
    """)).fetchall()
    return [{"mes": str(r[0]), "plataforma": r[1], "nuevos": r[2]} for r in rows]


@router.get("/rs/por-estado-plataforma")
def rs_por_estado_plataforma(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT p.nombre AS plataforma, r.estado, COUNT(*) AS total
        FROM reportes_rs r
        JOIN plataformas_rs p ON p.id = r.plataforma_id
        WHERE r.estado IS NOT NULL
          AND (:fi IS NULL OR r.fecha_reporte >= :fi)
          AND (:ff IS NULL OR r.fecha_reporte <= :ff)
        GROUP BY p.nombre, r.estado ORDER BY p.nombre, total DESC
    """), {"fi": fecha_inicio, "ff": _fin(fecha_fin)}).fetchall()
    return [{"plataforma": r[0], "estado": r[1], "total": r[2]} for r in rows]


@router.get("/rs/tendencia-metricas")
def rs_tendencia_metricas(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    granularidad: str = Query("dia", pattern="^(dia|semana|mes)$"),
    plataforma_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    trunc = {"dia": "day", "semana": "week", "mes": "month"}[granularidad]
    plat_filter = "AND e.plataforma_id = :pid" if plataforma_id else ""
    ff = _fin(fecha_fin)
    rows = db.execute(text(f"""
        SELECT DATE_TRUNC('{trunc}', e.fecha_reporte) AS periodo,
               p.nombre AS plataforma, kv.key AS slug,
               SUM((e.valores ->> kv.key)::numeric) AS total
        FROM estadisticas_rs e
        JOIN plataformas_rs p ON p.id = e.plataforma_id
        CROSS JOIN LATERAL jsonb_each_text(e.valores) AS kv
        WHERE (:fi IS NULL OR e.fecha_reporte >= :fi)
          AND (:ff IS NULL OR e.fecha_reporte <= :ff)
          {plat_filter}
        GROUP BY periodo, p.nombre, kv.key ORDER BY periodo, p.nombre, kv.key
    """), {"fi": fecha_inicio, "ff": ff, "pid": plataforma_id}).fetchall()
    return [
        {"periodo": str(r[0]), "plataforma": r[1], "slug": r[2], "total": float(r[3] or 0)}
        for r in rows
    ]


@router.get("/ultima-actividad")
def ultima_actividad(db: Session = Depends(get_db)):
    fecha = db.execute(text("SELECT MAX(fecha_reporte)::date FROM reportes")).scalar()
    return {"fecha": str(fecha) if fecha else None}


@router.get("/rs/ultima-actividad")
def rs_ultima_actividad(db: Session = Depends(get_db)):
    fecha = db.execute(text("SELECT MAX(fecha_reporte)::date FROM reportes_rs")).scalar()
    return {"fecha": str(fecha) if fecha else None}


# ─── Nuevas estadísticas avanzadas ────────────────────────────────────────────

@router.get("/horario")
def actividad_horaria(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Distribución de contactos por hora del día (ventanas de propagación)."""
    q = db.execute(text("""
        SELECT EXTRACT(HOUR FROM fecha_reporte AT TIME ZONE 'America/Mexico_City')::int AS hora,
               COUNT(*) AS total
        FROM reportes
        WHERE (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
          AND (:evento_id IS NULL OR evento_id = :evento_id)
        GROUP BY hora ORDER BY hora
    """), {"fi": fecha_inicio, "ff": fecha_fin, "evento_id": evento_id})
    hours = {r[0]: r[1] for r in q}
    return [{"hora": h, "total": hours.get(h, 0)} for h in range(24)]


@router.get("/top-indicativos")
def top_indicativos(
    limite: int = 20,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Top operadores por número de contactos con estado y zona."""
    rows = db.execute(text("""
        SELECT r.indicativo,
               COUNT(*) AS total,
               COUNT(DISTINCT r.estado) AS estados,
               COUNT(DISTINCT r.zona)   AS zonas,
               MAX(r.fecha_reporte)     AS ultimo,
               rx.nombre_completo
        FROM reportes r
        LEFT JOIN radioexperimentadores rx ON rx.indicativo = r.indicativo
        WHERE (:fi IS NULL OR r.fecha_reporte >= :fi)
          AND (:ff IS NULL OR r.fecha_reporte <= :ff)
          AND (:evento_id IS NULL OR r.evento_id = :evento_id)
        GROUP BY r.indicativo, rx.nombre_completo
        ORDER BY total DESC LIMIT :lim
    """), {"fi": fecha_inicio, "ff": fecha_fin, "lim": limite, "evento_id": evento_id}).fetchall()
    return [
        {"indicativo": r[0], "total": r[1], "estados": r[2], "zonas": r[3],
         "ultimo": str(r[4]) if r[4] else None, "nombre": r[5]}
        for r in rows
    ]


@router.get("/zona-actividad")
def zona_actividad(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Actividad por zona FMRE: contactos, indicativos únicos, señal promedio."""
    rows = db.execute(text("""
        SELECT zona,
               COUNT(*) AS total,
               COUNT(DISTINCT indicativo) AS indicativos,
               ROUND(AVG(senal), 1) AS senal_promedio
        FROM reportes
        WHERE zona IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
          AND (:evento_id IS NULL OR evento_id = :evento_id)
        GROUP BY zona ORDER BY total DESC
    """), {"fi": fecha_inicio, "ff": _fin(fecha_fin), "evento_id": evento_id}).fetchall()
    return [{"zona": r[0], "total": r[1], "indicativos": r[2], "senal_promedio": float(r[3] or 0)} for r in rows]


@router.get("/primera-actividad")
def primera_actividad(db: Session = Depends(get_db)):
    fecha = db.execute(text("SELECT MIN(fecha_reporte)::date FROM reportes")).scalar()
    return {"fecha": str(fecha) if fecha else None}


@router.get("/nuevos-mensuales")
def nuevos_mensuales(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Primeras apariciones de indicativos por mes (crecimiento de la red)."""
    ff = _fin(fecha_fin)
    rows = db.execute(text("""
        WITH primera AS (
            SELECT indicativo, MIN(fecha_reporte) AS primera_vez
            FROM reportes
            WHERE (:fi IS NULL OR fecha_reporte >= :fi)
              AND (:ff IS NULL OR fecha_reporte <= :ff)
              AND (:ev IS NULL OR evento_id = :ev)
            GROUP BY indicativo
        )
        SELECT DATE_TRUNC('month', primera_vez) AS mes, COUNT(*) AS nuevos
        FROM primera GROUP BY mes ORDER BY mes
    """), {"fi": fecha_inicio, "ff": ff, "ev": evento_id}).fetchall()
    return [{"mes": str(r[0]), "nuevos": r[1]} for r in rows]


@router.get("/retencion")
def retencion(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retención mensual: cuántos indicativos del mes anterior repiten actividad."""
    ff = _fin(fecha_fin)
    rows = db.execute(text("""
        WITH mensual AS (
            SELECT indicativo, DATE_TRUNC('month', fecha_reporte) AS mes
            FROM reportes
            WHERE (:fi IS NULL OR fecha_reporte >= :fi)
              AND (:ff IS NULL OR fecha_reporte <= :ff)
              AND (:ev IS NULL OR evento_id = :ev)
            GROUP BY indicativo, DATE_TRUNC('month', fecha_reporte)
        ),
        pares AS (
            SELECT a.mes,
                   COUNT(DISTINCT a.indicativo) AS activos,
                   COUNT(DISTINCT b.indicativo) AS retenidos
            FROM mensual a
            LEFT JOIN mensual b
              ON b.indicativo = a.indicativo
              AND b.mes = a.mes - INTERVAL '1 month'
            GROUP BY a.mes
        )
        SELECT mes, activos, retenidos,
               CASE WHEN activos > 0 THEN ROUND(retenidos::numeric / activos * 100, 1) ELSE 0 END AS tasa
        FROM pares ORDER BY mes
    """), {"fi": fecha_inicio, "ff": ff, "ev": evento_id}).fetchall()
    return [{"mes": str(r[0]), "activos": r[1], "retenidos": r[2], "tasa": float(r[3])} for r in rows]


@router.get("/cobertura-estados")
def cobertura_estados(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Todos los estados del catálogo con su actividad en el período."""
    ff = _fin(fecha_fin)
    catalog = db.query(models.Estado).order_by(models.Estado.nombre).all()
    rows = db.execute(text("""
        SELECT estado,
               COUNT(*)                  AS total,
               COUNT(DISTINCT indicativo) AS indicativos,
               ROUND(AVG(senal), 1)      AS senal_promedio
        FROM reportes
        WHERE estado IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
          AND (:ev IS NULL OR evento_id = :ev)
        GROUP BY estado
    """), {"fi": fecha_inicio, "ff": ff, "ev": evento_id}).fetchall()

    activity: dict = {}
    for r in rows:
        activity[r[0]] = {"total": r[1], "indicativos": r[2], "senal_promedio": float(r[3] or 0)}

    result = []
    for e in catalog:
        act = activity.get(e.abreviatura) or activity.get(e.nombre) or \
              {"total": 0, "indicativos": 0, "senal_promedio": 0.0}
        result.append({
            "abreviatura": e.abreviatura,
            "nombre": e.nombre,
            "zona": e.zona,
            "total": act["total"],
            "indicativos": act["indicativos"],
            "senal_promedio": act["senal_promedio"],
        })

    return sorted(result, key=lambda x: -x["total"])


@router.get("/rst-por-zona")
def rst_por_zona(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Distribución de RST (señal) por zona: muestra calidad de propagación."""
    rows = db.execute(text("""
        SELECT zona, senal, COUNT(*) AS total
        FROM reportes
        WHERE zona IS NOT NULL AND senal IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
          AND (:evento_id IS NULL OR evento_id = :evento_id)
        GROUP BY zona, senal ORDER BY zona, senal
    """), {"fi": fecha_inicio, "ff": fecha_fin, "evento_id": evento_id}).fetchall()
    return [{"zona": r[0], "senal": r[1], "total": r[2]} for r in rows]


@router.get("/sistemas-por-zona")
def sistemas_por_zona(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    evento_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Sistemas de comunicación usados por zona (infraestructura necesaria)."""
    rows = db.execute(text("""
        SELECT zona, sistema, COUNT(*) AS total
        FROM reportes
        WHERE zona IS NOT NULL AND sistema IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
          AND (:evento_id IS NULL OR evento_id = :evento_id)
        GROUP BY zona, sistema ORDER BY zona, total DESC
    """), {"fi": fecha_inicio, "ff": fecha_fin, "evento_id": evento_id}).fetchall()
    return [{"zona": r[0], "sistema": r[1], "total": r[2]} for r in rows]


@router.get("/tendencia-eventos")
def tendencia_eventos(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Tendencia mensual de reportes por tipo de evento."""
    rows = db.execute(text("""
        SELECT DATE_TRUNC('month', fecha_reporte) AS mes,
               tipo_reporte, COUNT(*) AS total
        FROM reportes
        WHERE tipo_reporte IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
        GROUP BY mes, tipo_reporte ORDER BY mes, total DESC
    """), {"fi": fecha_inicio, "ff": fecha_fin}).fetchall()
    return [{"mes": str(r[0]), "tipo": r[1], "total": r[2]} for r in rows]
