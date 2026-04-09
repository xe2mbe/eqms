"""
Router de configuración del sistema.
Almacena ajustes como pares clave-valor en la tabla configuracion_sistema.
Solo administradores pueden leer/escribir.
"""
import json
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import require_admin

router = APIRouter()

SMTP_KEY = "smtp"
RECORDATORIO_KEY = "dias_reaparicion"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_valor(db: Session, clave: str) -> str | None:
    row = db.query(models.ConfiguracionSistema).filter_by(clave=clave).first()
    return row.valor if row else None


def _set_valor(db: Session, clave: str, valor: str):
    row = db.query(models.ConfiguracionSistema).filter_by(clave=clave).first()
    if row:
        row.valor = valor
    else:
        db.add(models.ConfiguracionSistema(clave=clave, valor=valor))
    db.commit()


def _load_smtp(db: Session) -> schemas.SmtpConfig:
    raw = _get_valor(db, SMTP_KEY)
    if raw:
        try:
            return schemas.SmtpConfig(**json.loads(raw))
        except Exception:
            pass
    return schemas.SmtpConfig()


# ─── SMTP ─────────────────────────────────────────────────────────────────────

@router.get("/smtp", response_model=schemas.SmtpConfig)
def get_smtp(db: Session = Depends(get_db), _=Depends(require_admin)):
    return _load_smtp(db)


@router.put("/smtp", response_model=schemas.SmtpConfig)
def save_smtp(body: schemas.SmtpConfig, db: Session = Depends(get_db), _=Depends(require_admin)):
    _set_valor(db, SMTP_KEY, body.model_dump_json())
    return body


@router.post("/smtp/probar", status_code=200)
def test_smtp(
    req: schemas.SmtpTestRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    cfg = _load_smtp(db)
    if not cfg.host or not cfg.usuario or not cfg.password:
        raise HTTPException(400, "Configura primero host, usuario y contraseña SMTP.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "✅ Prueba de correo – QMS FMRE"
    msg["From"] = cfg.remitente or cfg.usuario
    msg["To"] = req.destinatario
    msg.attach(MIMEText(
        "<h2>Prueba de configuración SMTP</h2>"
        "<p>Si recibes este correo, la configuración de correo electrónico "
        "del sistema <strong>QMS – FMRE</strong> es correcta.</p>",
        "html",
    ))

    try:
        context = ssl.create_default_context()
        if cfg.port == 465:
            # SSL/TLS directo
            with smtplib.SMTP_SSL(cfg.host, cfg.port, context=context, timeout=10) as s:
                s.login(cfg.usuario, cfg.password)
                s.sendmail(msg["From"], req.destinatario, msg.as_string())
        else:
            # STARTTLS (puerto 587 o cualquier otro)
            with smtplib.SMTP(cfg.host, cfg.port, timeout=10) as s:
                s.ehlo()
                if cfg.ssl:
                    s.starttls()
                    s.ehlo()
                s.login(cfg.usuario, cfg.password)
                s.sendmail(msg["From"], req.destinatario, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(400, "Error de autenticacion: usuario o contrasena incorrectos. Para Gmail usa una Contrasena de Aplicacion (no tu contrasena normal).")
    except smtplib.SMTPConnectError:
        raise HTTPException(400, f"No se pudo conectar a {cfg.host}:{cfg.port}.")
    except Exception as e:
        raise HTTPException(400, f"Error al enviar correo: {str(e)}")

    return {"ok": True, "mensaje": f"Correo enviado a {req.destinatario}"}


# ─── Recordatorio ─────────────────────────────────────────────────────────────

@router.get("/recordatorio", response_model=schemas.RecordatorioConfig)
def get_recordatorio(db: Session = Depends(get_db), _=Depends(require_admin)):
    raw = _get_valor(db, RECORDATORIO_KEY)
    try:
        dias = int(raw) if raw else 30
    except Exception:
        dias = 30
    return schemas.RecordatorioConfig(dias_reaparicion=dias)


@router.put("/recordatorio", response_model=schemas.RecordatorioConfig)
def save_recordatorio(
    body: schemas.RecordatorioConfig,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    _set_valor(db, RECORDATORIO_KEY, str(body.dias_reaparicion))
    return body
