from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from datetime import datetime
import math

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter()


@router.get("", response_model=schemas.PaginatedReportes)
def list_reportes(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    tipo_reporte: Optional[str] = None,
    sistema: Optional[str] = None,
    zona: Optional[str] = None,
    estado: Optional[str] = None,
    indicativo: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    q = db.query(models.Reporte)

    if fecha_inicio:
        q = q.filter(models.Reporte.fecha_reporte >= fecha_inicio)
    if fecha_fin:
        q = q.filter(models.Reporte.fecha_reporte <= fecha_fin)
    if tipo_reporte:
        q = q.filter(models.Reporte.tipo_reporte == tipo_reporte)
    if sistema:
        q = q.filter(models.Reporte.sistema == sistema)
    if zona:
        q = q.filter(models.Reporte.zona == zona)
    if estado:
        q = q.filter(models.Reporte.estado.ilike(f"%{estado}%"))
    if indicativo:
        q = q.filter(models.Reporte.indicativo.ilike(f"%{indicativo}%"))

    total = q.count()
    items = (
        q.order_by(models.Reporte.fecha_reporte.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Enrich with capturado_por_nombre
    usuario_ids = {r.capturado_por for r in items if r.capturado_por}
    usuarios = {}
    if usuario_ids:
        for u in db.query(models.Usuario).filter(models.Usuario.id.in_(usuario_ids)).all():
            usuarios[u.id] = u.full_name

    out_items = []
    for r in items:
        d = schemas.ReporteOut.model_validate(r)
        d.capturado_por_nombre = usuarios.get(r.capturado_por) if r.capturado_por else None
        out_items.append(d)

    return schemas.PaginatedReportes(
        items=out_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 1,
    )


@router.post("", response_model=schemas.ReporteOut, status_code=201)
def create_reporte(
    body: schemas.ReporteCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    data = body.model_dump()
    # Auto-asignar país desde prefijo del indicativo
    if not data.get("pais") and data.get("indicativo"):
        prefijo = db.execute(
            text(
                "SELECT pais FROM prefijos_pais "
                "WHERE :ind ILIKE (prefijo || '%') "
                "ORDER BY LENGTH(prefijo) DESC LIMIT 1"
            ),
            {"ind": data["indicativo"].upper()},
        ).scalar()
        data["pais"] = prefijo
    reporte = models.Reporte(**data, capturado_por=current_user.id)
    db.add(reporte)
    db.commit()
    db.refresh(reporte)

    _audit(db, current_user.id, "CREATE", "reportes", reporte.id, f"Nuevo reporte: {reporte.indicativo}")
    return reporte


@router.get("/{reporte_id}", response_model=schemas.ReporteOut)
def get_reporte(
    reporte_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    r = db.query(models.Reporte).filter(models.Reporte.id == reporte_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return r


@router.put("/{reporte_id}", response_model=schemas.ReporteOut)
def update_reporte(
    reporte_id: int,
    body: schemas.ReporteUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    r = db.query(models.Reporte).filter(models.Reporte.id == reporte_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(r, field, value)

    db.commit()
    db.refresh(r)
    _audit(db, current_user.id, "UPDATE", "reportes", r.id, f"Reporte actualizado: {r.indicativo}")
    return r


@router.delete("/{reporte_id}", status_code=204)
def delete_reporte(
    reporte_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    r = db.query(models.Reporte).filter(models.Reporte.id == reporte_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    _audit(db, current_user.id, "DELETE", "reportes", r.id, f"Reporte eliminado: {r.indicativo}")
    db.delete(r)
    db.commit()


def _audit(db, usuario_id, accion, tabla, registro_id, desc):
    db.add(models.AuditLog(
        usuario_id=usuario_id, accion=accion,
        tabla=tabla, registro_id=registro_id, descripcion=desc,
    ))
    db.commit()
