from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
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
