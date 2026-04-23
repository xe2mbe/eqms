from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import math

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin

router = APIRouter()


# ─── Estadísticas RS (métricas agregadas por plataforma) ─────────────────────

@router.get("/estadisticas")
def list_estadisticas_rs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    plataforma_id: Optional[int] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    q = db.query(models.EstadisticaRS)
    if plataforma_id:
        q = q.filter(models.EstadisticaRS.plataforma_id == plataforma_id)
    if fecha_inicio:
        q = q.filter(models.EstadisticaRS.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.EstadisticaRS.fecha_reporte <= fecha_fin)

    total = q.count()
    items = (
        q.order_by(models.EstadisticaRS.fecha_reporte.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    usuario_ids = {r.capturado_por for r in items if r.capturado_por}
    usuarios = {}
    if usuario_ids:
        for u in db.query(models.Usuario).filter(models.Usuario.id.in_(usuario_ids)).all():
            usuarios[u.id] = u.indicativo or u.full_name

    out = []
    for r in items:
        d = schemas.EstadisticaRSOut.model_validate(r)
        d.capturado_por_nombre = usuarios.get(r.capturado_por) if r.capturado_por else None
        out.append(d)

    return {
        "items": out,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 1,
    }


@router.post("/estadisticas", response_model=schemas.EstadisticaRSOut, status_code=201)
def create_estadistica_rs(
    body: schemas.EstadisticaRSCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    plataforma = db.query(models.PlataformaRS).filter(
        models.PlataformaRS.id == body.plataforma_id,
        models.PlataformaRS.is_active == True,
    ).first()
    if not plataforma:
        raise HTTPException(404, "Plataforma no encontrada")

    e = models.EstadisticaRS(
        plataforma_id=body.plataforma_id,
        valores=body.valores,
        fecha_reporte=body.fecha_reporte,
        observaciones=body.observaciones,
        capturado_por=current_user.id,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.put("/estadisticas/{eid}", response_model=schemas.EstadisticaRSOut)
def update_estadistica_rs(
    eid: int,
    body: schemas.EstadisticaRSCreate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    e = db.query(models.EstadisticaRS).filter(models.EstadisticaRS.id == eid).first()
    if not e:
        raise HTTPException(404, "Registro no encontrado")
    e.plataforma_id = body.plataforma_id
    e.valores = body.valores
    e.fecha_reporte = body.fecha_reporte
    e.observaciones = body.observaciones
    db.commit()
    db.refresh(e)
    return e


@router.delete("/estadisticas/{eid}", status_code=204)
def delete_estadistica_rs(
    eid: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    e = db.query(models.EstadisticaRS).filter(models.EstadisticaRS.id == eid).first()
    if not e:
        raise HTTPException(404, "Registro no encontrado")
    db.delete(e)
    db.commit()


# ─── Reportes RS (estaciones que reportan vía RS) ────────────────────────────

@router.get("/reportes")
def list_reportes_rs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    plataforma_id: Optional[int] = None,
    indicativo: Optional[str] = None,
    tipo_reporte: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    q = db.query(models.ReporteRS)
    if plataforma_id:
        q = q.filter(models.ReporteRS.plataforma_id == plataforma_id)
    if indicativo:
        q = q.filter(models.ReporteRS.indicativo.ilike(f"%{indicativo}%"))
    if tipo_reporte:
        q = q.filter(models.ReporteRS.tipo_reporte == tipo_reporte)
    if fecha_inicio:
        q = q.filter(models.ReporteRS.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.ReporteRS.fecha_reporte <= fecha_fin)

    total = q.count()
    items = (
        q.order_by(models.ReporteRS.fecha_reporte.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    usuario_ids = {r.capturado_por for r in items if r.capturado_por}
    usuarios = {}
    if usuario_ids:
        for u in db.query(models.Usuario).filter(models.Usuario.id.in_(usuario_ids)).all():
            usuarios[u.id] = u.indicativo or u.full_name

    out = []
    for r in items:
        d = schemas.ReporteRSOut.model_validate(r)
        d.capturado_por_nombre = usuarios.get(r.capturado_por) if r.capturado_por else None
        out.append(d)

    return {
        "items": out,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 1,
    }


@router.post("/reportes", response_model=schemas.ReporteRSOut, status_code=201)
def create_reporte_rs(
    body: schemas.ReporteRSCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    # Auto-asignar país desde prefijo
    pais = body.pais
    if not pais and body.indicativo:
        result = db.execute(
            text("SELECT pais FROM prefijos_pais WHERE :ind ILIKE (prefijo || '%') ORDER BY LENGTH(prefijo) DESC LIMIT 1"),
            {"ind": body.indicativo.upper()},
        ).scalar()
        pais = result

    r = models.ReporteRS(
        **{k: v for k, v in body.model_dump().items() if k != "pais"},
        pais=pais,
        capturado_por=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/reportes/{rid}", response_model=schemas.ReporteRSOut)
def update_reporte_rs(
    rid: int,
    body: schemas.ReporteRSCreate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    r = db.query(models.ReporteRS).filter(models.ReporteRS.id == rid).first()
    if not r:
        raise HTTPException(404, "Reporte no encontrado")
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/reportes/{rid}", status_code=204)
def delete_reporte_rs(
    rid: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    r = db.query(models.ReporteRS).filter(models.ReporteRS.id == rid).first()
    if not r:
        raise HTTPException(404, "Reporte no encontrado")
    db.delete(r)
    db.commit()
