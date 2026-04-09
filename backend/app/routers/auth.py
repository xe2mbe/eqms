from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os, uuid

from app.database import get_db
from app import models, schemas
from app.auth import (
    verify_password, hash_password,
    create_access_token, create_refresh_token, decode_token,
    get_current_user,
)

router = APIRouter()

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _register_audit(db, usuario_id, accion, descripcion, ip=None):
    log = models.AuditLog(
        usuario_id=usuario_id,
        accion=accion,
        descripcion=descripcion,
        ip_address=ip,
    )
    db.add(log)
    db.commit()


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.username == body.username).first()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Verificar bloqueo
    if user.locked_until and datetime.now(timezone.utc) < user.locked_until:
        raise HTTPException(
            status_code=429,
            detail=f"Cuenta bloqueada temporalmente. Intenta de nuevo más tarde.",
        )

    if not verify_password(body.password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_ATTEMPTS:
            from datetime import timedelta
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(
                status_code=429,
                detail=f"Demasiados intentos fallidos. Cuenta bloqueada por {LOCKOUT_MINUTES} minutos.",
            )
        db.commit()
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Login exitoso
    user.failed_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    ip = request.client.host if request.client else None
    _register_audit(db, user.id, "LOGIN", f"Inicio de sesión desde {ip}", ip)

    access = create_access_token({"sub": user.username, "role": user.role})
    refresh = create_refresh_token({"sub": user.username})

    return schemas.TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=schemas.UsuarioOut.model_validate(user),
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_token(body: dict, db: Session = Depends(get_db)):
    token = body.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token requerido")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresco inválido")

    user = db.query(models.Usuario).filter(models.Usuario.username == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    access = create_access_token({"sub": user.username, "role": user.role})
    refresh = create_refresh_token({"sub": user.username})

    return schemas.TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=schemas.UsuarioOut.model_validate(user),
    )


@router.post("/change-password")
def change_password(
    body: schemas.ChangePasswordRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.utils.validators import validate_password
    ok, msg = validate_password(body.new_password)
    if not ok:
        raise HTTPException(status_code=422, detail=msg)

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    db.commit()

    _register_audit(db, current_user.id, "UPDATE", "Cambio de contraseña")
    return {"message": "Contraseña actualizada correctamente"}


@router.post("/logout")
def logout(
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _register_audit(db, current_user.id, "LOGOUT", "Cierre de sesión")
    return {"message": "Sesión cerrada"}


@router.get("/me", response_model=schemas.UsuarioOut)
def me(current_user: models.Usuario = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UsuarioOut)
def update_me(
    body: schemas.UsuarioProfileUpdate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


UPLOADS_DIR = "/app/uploads/avatars"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB


@router.post("/me/avatar", response_model=schemas.UsuarioOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usa JPG, PNG o WebP.")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="La imagen no debe superar 2 MB.")

    os.makedirs(UPLOADS_DIR, exist_ok=True)

    # Delete old avatar file if it exists
    if current_user.avatar:
        old_path = f"/app{current_user.avatar}"
        if os.path.isfile(old_path):
            os.remove(old_path)

    ext = os.path.splitext(file.filename or "avatar.jpg")[1] or ".jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    current_user.avatar = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user
