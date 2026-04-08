from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app import models

router = APIRouter()


class OperadorOut(BaseModel):
    indicativo: str
    nombre_completo: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    tipo_licencia: Optional[str] = None
    tipo_ham: Optional[str] = None
    activo: bool = True

    class Config:
        from_attributes = True


@router.get("/buscar/{indicativo}", response_model=OperadorOut)
def buscar_operador(indicativo: str, db: Session = Depends(get_db)):
    """Busca un operador por indicativo exacto para auto-completar la libreta."""
    op = (
        db.query(models.Radioexperimentador)
        .filter(models.Radioexperimentador.indicativo == indicativo.strip().upper())
        .first()
    )
    if not op:
        raise HTTPException(status_code=404, detail="Operador no encontrado")
    return op


@router.get("/autocomplete", response_model=List[OperadorOut])
def autocomplete(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
):
    """Retorna hasta 10 operadores cuyo indicativo empieza con el texto dado."""
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
