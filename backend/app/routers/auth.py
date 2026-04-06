from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

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
