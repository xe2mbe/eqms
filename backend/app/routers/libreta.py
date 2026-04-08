from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter()

RECORDATORIO_KEY = "dias_reaparicion"

def _get_dias_reaparicion(db: Session) -> int:
    row = db.query(models.ConfiguracionSistema).filter_by(clave=RECORDATORIO_KEY).first()
    try:
        return int(row.valor) if row else 30
    except Exception:
        return 30


# ─── Config de libreta por usuario ───────────────────────────────────────────

@router.get("/config", response_model=schemas.LibretaConfigOut)
def get_libreta_config(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    cfg = (
        db.query(models.LibretaConfigUsuario)
        .filter(models.LibretaConfigUsuario.usuario_id == current_user.id)
        .first()
    )
    return cfg or schemas.LibretaConfigOut()


@router.put("/config", response_model=schemas.LibretaConfigOut)
def save_libreta_config(
    body: schemas.LibretaConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    cfg = (
        db.query(models.LibretaConfigUsuario)
        .filter(models.LibretaConfigUsuario.usuario_id == current_user.id)
        .first()
    )
    if cfg:
        for k, v in body.model_dump().items():
            setattr(cfg, k, v)
    else:
        cfg = models.LibretaConfigUsuario(usuario_id=current_user.id, **body.model_dump())
        db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


# ─── Verificar indicativo (primera vez / reaparición) ────────────────────────

@router.get("/check/{indicativo}")
def check_indicativo(
    indicativo: str,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    """Devuelve si el indicativo es primera vez o reaparición según el umbral configurado."""
    dias_reaparicion = _get_dias_reaparicion(db)
    ind = indicativo.strip().upper()

    ultima = (
        db.query(func.max(models.Reporte.fecha_reporte))
        .filter(models.Reporte.indicativo == ind)
        .scalar()
    )

    es_primera_vez = ultima is None
    dias_sin_aparecer = None

    if ultima is not None:
        now = datetime.now(timezone.utc)
        if ultima.tzinfo is None:
            ultima = ultima.replace(tzinfo=timezone.utc)
        dias_sin_aparecer = (now - ultima).days

    return {
        "es_primera_vez": es_primera_vez,
        "ultima_aparicion": ultima.isoformat() if ultima else None,
        "dias_sin_aparecer": dias_sin_aparecer,
        "dias_reaparicion": dias_reaparicion,
        "es_reaparicion": (
            dias_sin_aparecer is not None and dias_sin_aparecer >= dias_reaparicion
        ),
    }


# ─── Registrar nueva estación (HAM) desde la libreta ─────────────────────────

@router.post("/nuevo-ham", status_code=201)
def nuevo_ham(
    body: schemas.NuevoHamCreate,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(get_current_user),
):
    """Crea o actualiza un radioexperimentador desde la captura de libreta."""
    ind = body.indicativo.strip().upper()
    ham = db.query(models.Radioexperimentador).filter_by(indicativo=ind).first()
    if ham:
        if body.nombre_completo:
            ham.nombre_completo = body.nombre_completo
        if body.municipio:
            ham.municipio = body.municipio
        if body.estado:
            ham.estado = body.estado
    else:
        ham = models.Radioexperimentador(
            indicativo=ind,
            nombre_completo=body.nombre_completo,
            municipio=body.municipio,
            estado=body.estado,
        )
        db.add(ham)
    db.commit()
    db.refresh(ham)
    return {"ok": True, "indicativo": ham.indicativo}
