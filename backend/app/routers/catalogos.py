from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin

router = APIRouter()


# ─── Eventos ─────────────────────────────────────────────────────────────────

@router.get("/eventos", response_model=List[schemas.EventoOut])
def list_eventos(db: Session = Depends(get_db)):
    return db.query(models.Evento).filter(models.Evento.is_active == True).order_by(models.Evento.tipo).all()

@router.post("/eventos", response_model=schemas.EventoOut, status_code=201)
def create_evento(body: schemas.EventoCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = models.Evento(**body.model_dump())
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.put("/eventos/{evento_id}", response_model=schemas.EventoOut)
def update_evento(evento_id: int, body: schemas.EventoCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(models.Evento).filter(models.Evento.id == evento_id).first()
    if not e: raise HTTPException(404, "Evento no encontrado")
    for k, v in body.model_dump().items(): setattr(e, k, v)
    db.commit(); db.refresh(e)
    return e

@router.delete("/eventos/{evento_id}", status_code=204)
def delete_evento(evento_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(models.Evento).filter(models.Evento.id == evento_id).first()
    if not e: raise HTTPException(404, "Evento no encontrado")
    e.is_active = False; db.commit()


# ─── Estaciones ───────────────────────────────────────────────────────────────

@router.get("/estaciones", response_model=List[schemas.EstacionOut])
def list_estaciones(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Estacion).filter(models.Estacion.is_active == True).order_by(models.Estacion.qrz).all()

@router.post("/estaciones", response_model=schemas.EstacionOut, status_code=201)
def create_estacion(body: schemas.EstacionCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = models.Estacion(**body.model_dump())
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.delete("/estaciones/{est_id}", status_code=204)
def delete_estacion(est_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(models.Estacion).filter(models.Estacion.id == est_id).first()
    if not e: raise HTTPException(404, "Estación no encontrada")
    e.is_active = False; db.commit()


# ─── Zonas ───────────────────────────────────────────────────────────────────

@router.get("/zonas", response_model=List[schemas.ZonaOut])
def list_zonas(db: Session = Depends(get_db)):
    return db.query(models.Zona).filter(models.Zona.is_active == True).all()


# ─── Sistemas ────────────────────────────────────────────────────────────────

@router.get("/sistemas", response_model=List[schemas.SistemaOut])
def list_sistemas(db: Session = Depends(get_db)):
    return db.query(models.Sistema).filter(models.Sistema.is_active == True).all()


# ─── Estados ─────────────────────────────────────────────────────────────────

@router.get("/estados", response_model=List[schemas.EstadoOut])
def list_estados(db: Session = Depends(get_db)):
    return db.query(models.Estado).order_by(models.Estado.nombre).all()


# ─── Plataformas RS ───────────────────────────────────────────────────────────

@router.get("/plataformas-rs", response_model=List[schemas.PlataformaRSOut])
def list_plataformas(db: Session = Depends(get_db)):
    return db.query(models.PlataformaRS).filter(models.PlataformaRS.is_active == True).all()
