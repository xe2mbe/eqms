from datetime import datetime, timezone
import logging
import re

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("qms")

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
    updates = body.model_dump(exclude_unset=True)
    if cfg:
        for k, v in updates.items():
            setattr(cfg, k, v)
    else:
        cfg = models.LibretaConfigUsuario(usuario_id=current_user.id, **updates)
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

    ultimo_reporte = (
        db.query(models.Reporte)
        .filter(models.Reporte.indicativo == ind)
        .order_by(models.Reporte.fecha_reporte.desc())
        .first()
    )

    ultima = ultimo_reporte.fecha_reporte if ultimo_reporte else None
    es_primera_vez = ultima is None
    dias_sin_aparecer = None
    ultimo_sistema = None

    if ultimo_reporte and ultimo_reporte.sistema_id:
        sistema = db.get(models.Sistema, ultimo_reporte.sistema_id)
        if sistema:
            ultimo_sistema = sistema.codigo

    if ultima is not None:
        now = datetime.now(timezone.utc)
        if ultima.tzinfo is None:
            ultima = ultima.replace(tzinfo=timezone.utc)
        dias_sin_aparecer = (now - ultima).days

    return {
        "es_primera_vez": es_primera_vez,
        "ultima_aparicion": ultima.isoformat() if ultima else None,
        "ultimo_sistema": ultimo_sistema,
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


# ─── Proxy REST → Brandmeister Last Heard ────────────────────────────────────

@router.get("/dmr-lastheard")
async def dmr_lastheard(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    cfg = (
        db.query(models.LibretaConfigUsuario)
        .filter(models.LibretaConfigUsuario.usuario_id == current_user.id)
        .first()
    )
    if not cfg or not cfg.bm_api_key:
        return {"active": False, "callsign": "", "tg": 0, "tg_name": "", "error": "no_api_key"}

    tgs_raw = cfg.bm_tgs or "33450,334"
    tgs = [t.strip() for t in re.split(r'[,.]', tgs_raw) if t.strip().isdigit()]

    headers = {"Authorization": f"Bearer {cfg.bm_api_key}"}

    dbg_parts: list[str] = []

    async with httpx.AsyncClient(timeout=6.0) as http:
        for tg in tgs:
            url = f"https://api.brandmeister.network/v2/talkgroup/{tg}/"
            try:
                r = await http.get(url, headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    logger.debug(f"BM TG {tg}: {str(data)[:500]}")
                    if isinstance(data, dict):
                        keys = list(data.keys())
                        dbg_parts.append(f"TG{tg}:keys={keys}")
                        # Buscar campos de actividad conocidos
                        src = (data.get("SourceCall") or data.get("CurrentCall")
                               or data.get("CurrentTX") or data.get("Active"))
                        if src:
                            return {
                                "active": True,
                                "callsign": str(src),
                                "tg": int(tg),
                                "tg_name": data.get("Name", ""),
                            }
                    else:
                        dbg_parts.append(f"TG{tg}:type={type(data).__name__}")
                else:
                    dbg_parts.append(f"TG{tg}:{r.status_code}")
            except Exception as exc:
                logger.warning(f"BM REST TG {tg}: {exc}")
                dbg_parts.append(f"TG{tg}:err")

    logger.debug(f"BM lastheard sin actividad: {' | '.join(dbg_parts)}")
    return {"active": False, "callsign": "", "tg": 0, "tg_name": ""}
