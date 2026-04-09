from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from datetime import datetime

from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/resumen", response_model=schemas.EstadisticaResumen)
def resumen(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    tipo_reporte: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    q = db.query(models.Reporte)
    if fecha_inicio:
        q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        # Si llega solo fecha (sin hora), incluir todo ese día
        fin = fecha_fin if fecha_fin.hour or fecha_fin.minute else fecha_fin.replace(hour=23, minute=59, second=59)
        q = q.filter(models.Reporte.fecha_reporte <= fin)
    if tipo_reporte:
        q = q.filter(models.Reporte.tipo_reporte == tipo_reporte)

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
    db: Session = Depends(get_db),
):
    q = db.query(
        models.Reporte.estado,
        func.count().label("total")
    ).filter(models.Reporte.estado != None)

    if fecha_inicio:
        q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)

    rows = q.group_by(models.Reporte.estado).order_by(func.count().desc()).all()
    return [{"estado": e, "total": t} for e, t in rows]


@router.get("/por-sistema")
def por_sistema(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(
        models.Reporte.sistema,
        func.count().label("total")
    ).filter(models.Reporte.sistema != None)

    if fecha_inicio:
        q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)

    rows = q.group_by(models.Reporte.sistema).order_by(func.count().desc()).all()
    return [{"sistema": s, "total": t} for s, t in rows]


@router.get("/tendencia")
def tendencia(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    granularidad: str = Query("dia", pattern="^(dia|semana|mes)$"),
    db: Session = Depends(get_db),
):
    if granularidad == "mes":
        trunc = func.date_trunc("month", models.Reporte.fecha_reporte)
    elif granularidad == "semana":
        trunc = func.date_trunc("week", models.Reporte.fecha_reporte)
    else:
        trunc = func.date_trunc("day", models.Reporte.fecha_reporte)

    q = db.query(trunc.label("periodo"), func.count().label("total"))

    if fecha_inicio:
        q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)

    rows = q.group_by("periodo").order_by("periodo").all()
    return [{"periodo": str(p), "total": t} for p, t in rows]


@router.get("/rs/resumen")
def rs_resumen(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(
        models.PlataformaRS.nombre,
        func.sum(models.EstadisticaRS.me_gusta).label("me_gusta"),
        func.sum(models.EstadisticaRS.comentarios).label("comentarios"),
        func.sum(models.EstadisticaRS.compartidos).label("compartidos"),
        func.sum(models.EstadisticaRS.reproducciones).label("reproducciones"),
    ).join(models.PlataformaRS)

    if fecha_inicio:
        q = q.filter(models.EstadisticaRS.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.EstadisticaRS.fecha_reporte <= fecha_fin)

    rows = q.group_by(models.PlataformaRS.nombre).all()
    return [
        {
            "plataforma": r.nombre,
            "me_gusta": int(r.me_gusta or 0),
            "comentarios": int(r.comentarios or 0),
            "compartidos": int(r.compartidos or 0),
            "reproducciones": int(r.reproducciones or 0),
        }
        for r in rows
    ]


# ─── Nuevas estadísticas avanzadas ────────────────────────────────────────────

@router.get("/horario")
def actividad_horaria(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Distribución de contactos por hora del día (ventanas de propagación)."""
    q = db.execute(text("""
        SELECT EXTRACT(HOUR FROM fecha_reporte AT TIME ZONE 'America/Mexico_City')::int AS hora,
               COUNT(*) AS total
        FROM reportes
        WHERE (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
        GROUP BY hora ORDER BY hora
    """), {"fi": fecha_inicio, "ff": fecha_fin})
    hours = {r[0]: r[1] for r in q}
    return [{"hora": h, "total": hours.get(h, 0)} for h in range(24)]


@router.get("/top-indicativos")
def top_indicativos(
    limite: int = 20,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
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
        GROUP BY r.indicativo, rx.nombre_completo
        ORDER BY total DESC LIMIT :lim
    """), {"fi": fecha_inicio, "ff": fecha_fin, "lim": limite}).fetchall()
    return [
        {"indicativo": r[0], "total": r[1], "estados": r[2], "zonas": r[3],
         "ultimo": str(r[4]) if r[4] else None, "nombre": r[5]}
        for r in rows
    ]


@router.get("/zona-actividad")
def zona_actividad(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
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
        GROUP BY zona ORDER BY total DESC
    """), {"fi": fecha_inicio, "ff": fecha_fin}).fetchall()
    return [{"zona": r[0], "total": r[1], "indicativos": r[2], "senal_promedio": float(r[3] or 0)} for r in rows]


@router.get("/nuevos-mensuales")
def nuevos_mensuales(db: Session = Depends(get_db)):
    """Primeras apariciones de indicativos por mes (crecimiento de la red)."""
    rows = db.execute(text("""
        WITH primera AS (
            SELECT indicativo, MIN(fecha_reporte) AS primera_vez
            FROM reportes GROUP BY indicativo
        )
        SELECT DATE_TRUNC('month', primera_vez) AS mes, COUNT(*) AS nuevos
        FROM primera
        GROUP BY mes ORDER BY mes
    """)).fetchall()
    return [{"mes": str(r[0]), "nuevos": r[1]} for r in rows]


@router.get("/retencion")
def retencion(db: Session = Depends(get_db)):
    """Retención mensual: cuántos indicativos del mes anterior repiten actividad."""
    rows = db.execute(text("""
        WITH mensual AS (
            SELECT indicativo,
                   DATE_TRUNC('month', fecha_reporte) AS mes
            FROM reportes
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
    """)).fetchall()
    return [{"mes": str(r[0]), "activos": r[1], "retenidos": r[2], "tasa": float(r[3])} for r in rows]


@router.get("/rst-por-zona")
def rst_por_zona(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Distribución de RST (señal) por zona: muestra calidad de propagación."""
    rows = db.execute(text("""
        SELECT zona, senal, COUNT(*) AS total
        FROM reportes
        WHERE zona IS NOT NULL AND senal IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
        GROUP BY zona, senal ORDER BY zona, senal
    """), {"fi": fecha_inicio, "ff": fecha_fin}).fetchall()
    return [{"zona": r[0], "senal": r[1], "total": r[2]} for r in rows]


@router.get("/sistemas-por-zona")
def sistemas_por_zona(
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    """Sistemas de comunicación usados por zona (infraestructura necesaria)."""
    rows = db.execute(text("""
        SELECT zona, sistema, COUNT(*) AS total
        FROM reportes
        WHERE zona IS NOT NULL AND sistema IS NOT NULL
          AND (:fi IS NULL OR fecha_reporte >= :fi)
          AND (:ff IS NULL OR fecha_reporte <= :ff)
        GROUP BY zona, sistema ORDER BY zona, total DESC
    """), {"fi": fecha_inicio, "ff": fecha_fin}).fetchall()
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
