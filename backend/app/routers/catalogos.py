from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel

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

@router.put("/estaciones/{est_id}", response_model=schemas.EstacionOut)
def update_estacion(est_id: int, body: schemas.EstacionCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(models.Estacion).filter(models.Estacion.id == est_id).first()
    if not e: raise HTTPException(404, "Estación no encontrada")
    for k, v in body.model_dump().items(): setattr(e, k, v)
    db.commit(); db.refresh(e)
    return e

@router.delete("/estaciones/{est_id}", status_code=204)
def delete_estacion(est_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(models.Estacion).filter(models.Estacion.id == est_id).first()
    if not e: raise HTTPException(404, "Estación no encontrada")
    e.is_active = False; db.commit()


# ─── Zonas ───────────────────────────────────────────────────────────────────

class ZonaCreate(BaseModel):
    codigo: str
    nombre: str
    color: str = "#1677ff"
    is_active: bool = True

@router.get("/zonas", response_model=List[schemas.ZonaOut])
def list_zonas(db: Session = Depends(get_db)):
    return db.query(models.Zona).all()

@router.post("/zonas", response_model=schemas.ZonaOut, status_code=201)
def create_zona(body: ZonaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    z = models.Zona(**body.model_dump())
    db.add(z); db.commit(); db.refresh(z)
    return z

@router.put("/zonas/{zona_id}", response_model=schemas.ZonaOut)
def update_zona(zona_id: int, body: ZonaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    z = db.query(models.Zona).filter(models.Zona.id == zona_id).first()
    if not z: raise HTTPException(404, "Zona no encontrada")
    for k, v in body.model_dump().items(): setattr(z, k, v)
    db.commit(); db.refresh(z)
    return z

@router.delete("/zonas/{zona_id}", status_code=204)
def delete_zona(zona_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    z = db.query(models.Zona).filter(models.Zona.id == zona_id).first()
    if not z: raise HTTPException(404, "Zona no encontrada")
    z.is_active = False; db.commit()


# ─── Sistemas ────────────────────────────────────────────────────────────────

class SistemaCreate(BaseModel):
    codigo: str
    nombre: str
    color: Optional[str] = "#1677ff"
    is_active: bool = True

@router.get("/sistemas", response_model=List[schemas.SistemaOut])
def list_sistemas(db: Session = Depends(get_db)):
    return db.query(models.Sistema).filter(models.Sistema.is_active == True).all()

@router.post("/sistemas", response_model=schemas.SistemaOut, status_code=201)
def create_sistema(body: SistemaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = models.Sistema(**body.model_dump())
    db.add(s); db.commit(); db.refresh(s)
    return s

@router.put("/sistemas/{sistema_id}", response_model=schemas.SistemaOut)
def update_sistema(sistema_id: int, body: SistemaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(models.Sistema).filter(models.Sistema.id == sistema_id).first()
    if not s: raise HTTPException(404, "Sistema no encontrado")
    for k, v in body.model_dump().items(): setattr(s, k, v)
    db.commit(); db.refresh(s)
    return s

@router.delete("/sistemas/{sistema_id}", status_code=204)
def delete_sistema(sistema_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(models.Sistema).filter(models.Sistema.id == sistema_id).first()
    if not s: raise HTTPException(404, "Sistema no encontrado")
    s.is_active = False; db.commit()


# ─── Estados ─────────────────────────────────────────────────────────────────

class EstadoZonaUpdate(BaseModel):
    zona: str | None = None

class AsignacionZonas(BaseModel):
    # lista de {estado_id, zona_codigo}
    asignaciones: List[dict]

@router.get("/estados", response_model=List[schemas.EstadoOut])
def list_estados(db: Session = Depends(get_db)):
    return db.query(models.Estado).order_by(models.Estado.nombre).all()

@router.put("/estados/{estado_id}/zona", response_model=schemas.EstadoOut)
def update_estado_zona(
    estado_id: int,
    body: EstadoZonaUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    e = db.query(models.Estado).filter(models.Estado.id == estado_id).first()
    if not e:
        raise HTTPException(404, "Estado no encontrado")
    e.zona = body.zona or None
    db.commit(); db.refresh(e)
    return e

@router.post("/estados/asignar-zonas", status_code=200)
def asignar_zonas_bulk(
    body: AsignacionZonas,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Actualiza la zona de múltiples estados en una sola llamada."""
    updated = 0
    for item in body.asignaciones:
        e = db.query(models.Estado).filter(models.Estado.id == item["estado_id"]).first()
        if e:
            e.zona = item.get("zona") or None
            updated += 1
    db.commit()
    return {"ok": True, "actualizados": updated}


# ─── Prefijos de indicativos ──────────────────────────────────────────────────

@router.get("/prefijos/paises")
def list_paises(db: Session = Depends(get_db)):
    """Lista de países únicos ordenados alfabéticamente."""
    rows = (
        db.query(models.PrefijoPais.pais)
        .distinct()
        .order_by(models.PrefijoPais.pais)
        .all()
    )
    return [r.pais for r in rows]


@router.get("/prefijos/lookup/{indicativo}")
def lookup_prefijo(indicativo: str, db: Session = Depends(get_db)):
    """Devuelve el país y zona estimada a partir del indicativo, por coincidencia de prefijo más largo."""
    ind = indicativo.strip().upper()
    # Genera todas las sub-cadenas candidatas de mayor a menor longitud
    candidates = [ind[:i] for i in range(len(ind), 0, -1)]
    result = (
        db.query(models.PrefijoPais)
        .filter(models.PrefijoPais.prefijo.in_(candidates))
        .order_by(func.length(models.PrefijoPais.prefijo).desc())
        .first()
    )
    if not result:
        return {"pais": "Desconocido", "zona_codigo": None}
    return {"pais": result.pais, "zona_codigo": result.zona_codigo}


# ─── Plataformas RS ───────────────────────────────────────────────────────────

class PlataformaCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    is_active: bool = True

@router.get("/plataformas-rs", response_model=List[schemas.PlataformaRSOut])
def list_plataformas(db: Session = Depends(get_db)):
    return db.query(models.PlataformaRS).filter(models.PlataformaRS.is_active == True).all()

@router.post("/plataformas-rs", response_model=schemas.PlataformaRSOut, status_code=201)
def create_plataforma(body: PlataformaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    p = models.PlataformaRS(**body.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    # Seed métricas default para la nueva plataforma
    from app.seeds import METRICAS_DEFAULT
    for m in METRICAS_DEFAULT:
        db.add(models.MetricaRS(
            plataforma_id=p.id, nombre=m["nombre"], slug=m["slug"],
            is_active=True, is_default=True, orden=m["orden"],
        ))
    db.commit(); db.refresh(p)
    return p

@router.put("/plataformas-rs/{pid}", response_model=schemas.PlataformaRSOut)
def update_plataforma(pid: int, body: PlataformaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    p = db.query(models.PlataformaRS).filter(models.PlataformaRS.id == pid).first()
    if not p: raise HTTPException(404, "Plataforma no encontrada")
    for k, v in body.model_dump().items(): setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

@router.delete("/plataformas-rs/{pid}", status_code=204)
def delete_plataforma(pid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    p = db.query(models.PlataformaRS).filter(models.PlataformaRS.id == pid).first()
    if not p: raise HTTPException(404, "Plataforma no encontrada")
    p.is_active = False; db.commit()


# ─── Métricas RS ─────────────────────────────────────────────────────────────

@router.get("/plataformas-rs/{pid}/metricas", response_model=List[schemas.MetricaRSOut])
def list_metricas(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(models.MetricaRS)
        .filter(models.MetricaRS.plataforma_id == pid)
        .order_by(models.MetricaRS.orden)
        .all()
    )

@router.post("/plataformas-rs/{pid}/metricas", response_model=schemas.MetricaRSOut, status_code=201)
def create_metrica(pid: int, body: schemas.MetricaRSCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    p = db.query(models.PlataformaRS).filter(models.PlataformaRS.id == pid).first()
    if not p: raise HTTPException(404, "Plataforma no encontrada")
    slug = body.slug.strip().lower().replace(" ", "_")
    existe = db.query(models.MetricaRS).filter(
        models.MetricaRS.plataforma_id == pid,
        models.MetricaRS.slug == slug,
    ).first()
    if existe: raise HTTPException(400, "Ya existe una métrica con ese slug")
    m = models.MetricaRS(plataforma_id=pid, nombre=body.nombre, slug=slug,
                         is_active=body.is_active, is_default=False, orden=body.orden)
    db.add(m); db.commit(); db.refresh(m)
    return m

@router.put("/plataformas-rs/{pid}/metricas/{mid}", response_model=schemas.MetricaRSOut)
def update_metrica(pid: int, mid: int, body: schemas.MetricaRSUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(models.MetricaRS).filter(
        models.MetricaRS.id == mid, models.MetricaRS.plataforma_id == pid
    ).first()
    if not m: raise HTTPException(404, "Métrica no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return m

@router.delete("/plataformas-rs/{pid}/metricas/{mid}", status_code=204)
def delete_metrica(pid: int, mid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(models.MetricaRS).filter(
        models.MetricaRS.id == mid, models.MetricaRS.plataforma_id == pid
    ).first()
    if not m: raise HTTPException(404, "Métrica no encontrada")
    if m.is_default: raise HTTPException(400, "No se pueden eliminar las métricas predeterminadas, solo desactivarlas")
    db.delete(m); db.commit()
