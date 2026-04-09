from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json, smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin, hash_password

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


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_password = body.get("new_password")
    if not new_password:
        raise HTTPException(status_code=422, detail="new_password requerido")

    user.password_hash = hash_password(new_password)
    user.must_change_password = True
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()
    _audit(db, current_user.id, "UPDATE", "usuarios", user.id, f"Contraseña reseteada para: {user.username}")


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
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_admin),
):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if not user.email:
        raise HTTPException(400, "El usuario no tiene correo registrado")

    # Cargar config SMTP
    smtp_row = db.query(models.ConfiguracionSistema).filter_by(clave="smtp").first()
    if not smtp_row or not smtp_row.valor:
        raise HTTPException(400, "SMTP no configurado. Ve a Configuración → Correo Electrónico.")
    cfg = json.loads(smtp_row.valor)
    if not cfg.get("habilitado"):
        raise HTTPException(400, "El envío de correo está deshabilitado en la configuración.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Bienvenido al sistema QMS – FMRE"
    msg["From"] = cfg.get("remitente") or cfg["usuario"]
    msg["To"] = user.email
    html = f"""
    <h2>Bienvenido al Sistema QMS – FMRE</h2>
    <p>Hola <strong>{user.full_name}</strong>,</p>
    <p>Tu cuenta ha sido creada / actualizada en el sistema de gestión QMS de la
    <strong>Federación Mexicana de Radioexperimentadores A.C.</strong></p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0"><strong>Usuario:</strong></td><td>{user.username}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>Rol:</strong></td><td>{user.role}</td></tr>
      {'<tr><td style="padding:4px 12px 4px 0"><strong>Indicativo:</strong></td><td>' + user.indicativo + '</td></tr>' if user.indicativo else ''}
    </table>
    <p>Ingresa al sistema y cambia tu contraseña en el primer inicio de sesión.</p>
    <p style="color:#999;font-size:12px">QMS – FMRE | Este es un mensaje automático.</p>
    """
    msg.attach(MIMEText(html, "html"))

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
                    s.starttls()
                    s.ehlo()
                s.login(cfg["usuario"], cfg["password"])
                s.sendmail(msg["From"], user.email, msg.as_string())
    except Exception as e:
        raise HTTPException(400, f"Error al enviar correo: {str(e)}")

    _audit(db, current_user.id, "UPDATE", "usuarios", user.id, f"Correo de bienvenida reenviado a: {user.email}")
    return {"ok": True, "mensaje": f"Correo enviado a {user.email}"}


def _audit(db, usuario_id, accion, tabla, registro_id, desc):
    db.add(models.AuditLog(
        usuario_id=usuario_id, accion=accion,
        tabla=tabla, registro_id=registro_id, descripcion=desc,
    ))
    db.commit()
