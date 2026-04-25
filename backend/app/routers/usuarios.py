from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json, smtplib, ssl, secrets, string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin, hash_password


def _generar_password(longitud: int = 12) -> str:
    alfabeto = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        pwd = ''.join(secrets.choice(alfabeto) for _ in range(longitud))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


def _enviar_correo_bienvenida(db: Session, user: models.Usuario, password_texto: str):
    """Envía el correo de bienvenida/reset usando la plantilla configurada.
    Lanza HTTPException si SMTP no está listo."""
    smtp_row = db.query(models.ConfiguracionSistema).filter_by(clave="smtp").first()
    if not smtp_row or not smtp_row.valor:
        raise HTTPException(400, "SMTP no configurado. Ve a Configuración → Correo Electrónico.")
    cfg = json.loads(smtp_row.valor)
    if not cfg.get("habilitado"):
        raise HTTPException(400, "El envío de correo está deshabilitado en la configuración.")

    tpl_row = db.query(models.ConfiguracionSistema).filter_by(clave="email_bienvenida").first()
    tpl = (schemas.EmailBienvenidaConfig(**json.loads(tpl_row.valor))
           if tpl_row and tpl_row.valor else schemas.EmailBienvenidaConfig())

    info_row = db.query(models.ConfiguracionSistema).filter_by(clave="sistema_info").first()
    url_sistema = (json.loads(info_row.valor).get("url_sistema", "")
                   if info_row and info_row.valor else "")

    variables = {
        "full_name": user.full_name or "",
        "username": user.username or "",
        "password": password_texto,
        "url_sistema": url_sistema,
    }
    asunto = tpl.asunto
    cuerpo = tpl.cuerpo
    for var, val in variables.items():
        asunto = asunto.replace(f"{{{{{var}}}}}", val)
        cuerpo = cuerpo.replace(f"{{{{{var}}}}}", val)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"] = cfg.get("remitente") or cfg["usuario"]
    msg["To"] = user.email
    msg.attach(MIMEText(cuerpo, "html"))

    try:
        if cfg.get("port") == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], context=ctx, timeout=10) as s:
                s.login(cfg["usuario"], cfg["password"])
                s.sendmail(msg["From"], user.email, msg.as_string())
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as s:
                s.ehlo()
                if cfg.get("ssl"):
                    s.starttls(); s.ehlo()
                s.login(cfg["usuario"], cfg["password"])
                s.sendmail(msg["From"], user.email, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(400, "Error de autenticación SMTP.")
    except Exception as e:
        raise HTTPException(400, f"Error al enviar correo: {str(e)}")

router = APIRouter()


@router.get("", response_model=List[schemas.UsuarioOut])
def list_usuarios(
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(require_admin),
):
    return db.query(models.Usuario).order_by(models.Usuario.full_name).all()


@router.post("", response_model=schemas.UsuarioOut, status_code=201)
def create_usuario(
    body: schemas.UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    exists = db.query(models.Usuario).filter(models.Usuario.username == body.username).first()
    if exists:
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")

    user = models.Usuario(
        username=body.username,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        email=body.email,
        telefono=body.telefono,
        role=body.role,
        indicativo=body.indicativo,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _audit(db, current_user.id, "CREATE", "usuarios", user.id, f"Usuario creado: {user.username}")
    return user


@router.get("/{user_id}", response_model=schemas.UsuarioOut)
def get_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(require_admin),
):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.put("/{user_id}", response_model=schemas.UsuarioOut)
def update_usuario(
    user_id: int,
    body: schemas.UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    _audit(db, current_user.id, "UPDATE", "usuarios", user.id, f"Usuario actualizado: {user.username}")
    return user


@router.delete("/{user_id}", status_code=204)
def delete_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    _audit(db, current_user.id, "DELETE", "usuarios", user.id, f"Usuario eliminado: {user.username}")
    db.delete(user)
    db.commit()


@router.post("/{user_id}/reset-password", status_code=200)
def reset_password(
    user_id: int,
    body: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    password_texto = body.new_password.strip() if body.new_password.strip() else _generar_password()
    user.password_hash = hash_password(password_texto)
    user.must_change_password = body.must_change_password
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()

    if body.enviar_correo:
        if not user.email:
            raise HTTPException(400, "El usuario no tiene correo registrado")
        _enviar_correo_bienvenida(db, user, password_texto)

    _audit(db, current_user.id, "UPDATE", "usuarios", user.id, f"Contraseña reseteada: {user.username}")
    return {"ok": True, "password": password_texto}


@router.patch("/{user_id}/desactivar", response_model=schemas.UsuarioOut)
def desactivar_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(400, "No puedes desactivarte a ti mismo")
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.is_active = not user.is_active
    db.commit(); db.refresh(user)
    estado = "activado" if user.is_active else "desactivado"
    _audit(db, current_user.id, "UPDATE", "usuarios", user.id, f"Usuario {estado}: {user.username}")
    return user


@router.post("/{user_id}/reenviar-correo", status_code=200)
def reenviar_correo(
    user_id: int,
    body: schemas.ReenviarCorreoRequest = schemas.ReenviarCorreoRequest(),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if not user.email:
        raise HTTPException(400, "El usuario no tiene correo registrado")

    password_texto = body.password_inicial or "(ver con el administrador)"
    _enviar_correo_bienvenida(db, user, password_texto)

    _audit(db, current_user.id, "UPDATE", "usuarios", user.id, f"Correo de bienvenida reenviado a: {user.email}")
    return {"ok": True, "mensaje": f"Correo enviado a {user.email}"}


def _audit(db, usuario_id, accion, tabla, registro_id, desc):
    db.add(models.AuditLog(
        usuario_id=usuario_id, accion=accion,
        tabla=tabla, registro_id=registro_id, descripcion=desc,
    ))
    db.commit()
