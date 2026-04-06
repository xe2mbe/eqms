from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin, hash_password

router = APIRouter()


@router.get("/", response_model=List[schemas.UsuarioOut])
def list_usuarios(
    db: Session = Depends(get_db),
    _: models.Usuario = Depends(require_admin),
):
    return db.query(models.Usuario).order_by(models.Usuario.full_name).all()


@router.post("/", response_model=schemas.UsuarioOut, status_code=201)
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


def _audit(db, usuario_id, accion, tabla, registro_id, desc):
    db.add(models.AuditLog(
        usuario_id=usuario_id, accion=accion,
        tabla=tabla, registro_id=registro_id, descripcion=desc,
    ))
    db.commit()
