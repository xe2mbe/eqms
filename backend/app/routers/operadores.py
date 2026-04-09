from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel
import math


from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter()


class OperadorOut(BaseModel):
    id: int
    indicativo: str
    nombre_completo: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    zona: Optional[str] = None
    pais: Optional[str] = None
    tipo_licencia: Optional[str] = None
    tipo_ham: Optional[str] = None
    activo: bool = True

    class Config:
        from_attributes = True


class OperadorCreate(BaseModel):
    indicativo: str
    nombre_completo: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    pais: Optional[str] = "México"
    tipo_licencia: Optional[str] = None
    tipo_ham: Optional[str] = None
    activo: bool = True


class OperadorUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    pais: Optional[str] = None
    tipo_licencia: Optional[str] = None
    tipo_ham: Optional[str] = None
    activo: Optional[bool] = None


class PaginatedOperadores(BaseModel):
    items: List[OperadorOut]
    total: int
    page: int
    page_size: int
    pages: int


@router.get("", response_model=PaginatedOperadores)
def list_operadores(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None,
    estado: Optional[str] = None,
    zona: Optional[str] = None,
    pais: Optional[str] = None,
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    query = db.query(models.Radioexperimentador)
    if q:
        term = f"%{q.upper()}%"
        query = query.filter(
            or_(
                models.Radioexperimentador.indicativo.ilike(term),
                models.Radioexperimentador.nombre_completo.ilike(f"%{q}%"),
            )
        )
    if estado:
        query = query.filter(models.Radioexperimentador.estado.ilike(f"%{estado}%"))
    if zona:
        nombres_zona = [
            row.nombre for row in
            db.query(models.Estado.nombre)
              .filter(models.Estado.zona == zona.upper())
              .all()
        ]
        if nombres_zona:
            query = query.filter(
                or_(*[models.Radioexperimentador.estado.ilike(f"%{n}%") for n in nombres_zona])
            )
    if pais:
        query = query.filter(models.Radioexperimentador.pais.ilike(f"%{pais}%"))
    if activo is not None:
        query = query.filter(models.Radioexperimentador.activo == activo)

    total = query.count()
    rows = (
        query.order_by(models.Radioexperimentador.indicativo)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Build a zona lookup: estado_nombre -> zona_codigo
    estado_nombres = {r.estado for r in rows if r.estado}
    zona_map: dict[str, str] = {}
    if estado_nombres:
        estado_rows = (
            db.query(models.Estado.nombre, models.Estado.zona)
            .filter(models.Estado.nombre.in_(list(estado_nombres)))
            .all()
        )
        zona_map = {r.nombre: r.zona for r in estado_rows if r.zona}

    items = []
    for r in rows:
        out = OperadorOut.model_validate(r)
        out.zona = zona_map.get(r.estado) if r.estado else None
        items.append(out)

    return PaginatedOperadores(
        items=items, total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/buscar/{indicativo}", response_model=OperadorOut)
def buscar_operador(indicativo: str, db: Session = Depends(get_db)):
    op = (
        db.query(models.Radioexperimentador)
        .filter(models.Radioexperimentador.indicativo == indicativo.strip().upper())
        .first()
    )
    if not op:
        raise HTTPException(status_code=404, detail="Operador no encontrado")
    return op


@router.post("", response_model=OperadorOut, status_code=201)
def create_operador(
    body: OperadorCreate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    existing = db.query(models.Radioexperimentador).filter(
        models.Radioexperimentador.indicativo == body.indicativo.strip().upper()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El indicativo ya existe")
    op = models.Radioexperimentador(**body.model_dump())
    op.indicativo = op.indicativo.strip().upper()
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


@router.put("/{indicativo}", response_model=OperadorOut)
def update_operador(
    indicativo: str,
    body: OperadorUpdate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    op = db.query(models.Radioexperimentador).filter(
        models.Radioexperimentador.indicativo == indicativo.strip().upper()
    ).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operador no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(op, field, value)
    db.commit()
    db.refresh(op)
    return op


@router.delete("/{indicativo}", status_code=204)
def delete_operador(
    indicativo: str,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    op = db.query(models.Radioexperimentador).filter(
        models.Radioexperimentador.indicativo == indicativo.strip().upper()
    ).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operador no encontrado")
    db.delete(op)
    db.commit()


@router.get("/autocomplete", response_model=List[OperadorOut])
def autocomplete(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
):
    results = (
        db.query(models.Radioexperimentador)
        .filter(
            models.Radioexperimentador.indicativo.ilike(f"{q.upper()}%"),
            models.Radioexperimentador.activo == True,
        )
        .order_by(models.Radioexperimentador.indicativo)
        .limit(10)
        .all()
    )
    return results
