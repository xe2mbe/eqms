from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UsuarioOut"

class ChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Las contraseñas no coinciden")
        return v


# ─── Usuario ─────────────────────────────────────────────────────────────────

class UsuarioCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[EmailStr] = None
    role: str = "operador"
    indicativo: Optional[str] = None

class UsuarioUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    indicativo: Optional[str] = None
    is_active: Optional[bool] = None

class UsuarioOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str
    indicativo: Optional[str] = None
    is_active: bool
    must_change_password: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Catálogos ───────────────────────────────────────────────────────────────

class EventoOut(BaseModel):
    id: int
    tipo: str
    descripcion: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

class EventoCreate(BaseModel):
    tipo: str
    descripcion: Optional[str] = None

class EstacionOut(BaseModel):
    id: int
    qrz: str
    descripcion: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

class EstacionCreate(BaseModel):
    qrz: str
    descripcion: Optional[str] = None

class ZonaOut(BaseModel):
    id: int
    codigo: str
    nombre: str
    is_active: bool
    class Config:
        from_attributes = True

class SistemaOut(BaseModel):
    id: int
    codigo: str
    nombre: str
    is_active: bool
    class Config:
        from_attributes = True

class EstadoOut(BaseModel):
    id: int
    abreviatura: str
    nombre: str
    lat: Optional[str] = None
    lng: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Reportes ────────────────────────────────────────────────────────────────

class ReporteCreate(BaseModel):
    indicativo: str
    operador: Optional[str] = None
    senal: int = 59
    estado: Optional[str] = None
    ciudad: Optional[str] = None
    zona: Optional[str] = None
    sistema: Optional[str] = None
    tipo_reporte: str
    qrz_station: Optional[str] = None
    fecha_reporte: datetime
    observaciones: Optional[str] = None

class ReporteUpdate(BaseModel):
    indicativo: Optional[str] = None
    operador: Optional[str] = None
    senal: Optional[int] = None
    estado: Optional[str] = None
    ciudad: Optional[str] = None
    zona: Optional[str] = None
    sistema: Optional[str] = None
    tipo_reporte: Optional[str] = None
    qrz_station: Optional[str] = None
    fecha_reporte: Optional[datetime] = None
    observaciones: Optional[str] = None

class ReporteOut(BaseModel):
    id: int
    indicativo: str
    operador: Optional[str] = None
    senal: int
    estado: Optional[str] = None
    ciudad: Optional[str] = None
    zona: Optional[str] = None
    sistema: Optional[str] = None
    tipo_reporte: Optional[str] = None
    qrz_station: Optional[str] = None
    fecha_reporte: datetime
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PaginatedReportes(BaseModel):
    items: List[ReporteOut]
    total: int
    page: int
    page_size: int
    pages: int


# ─── Redes Sociales ──────────────────────────────────────────────────────────

class PlataformaRSOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

class EstadisticaRSCreate(BaseModel):
    plataforma_id: int
    me_gusta: int = 0
    comentarios: int = 0
    compartidos: int = 0
    reproducciones: int = 0
    fecha_reporte: datetime
    observaciones: Optional[str] = None

class EstadisticaRSOut(BaseModel):
    id: int
    plataforma_id: int
    plataforma: PlataformaRSOut
    me_gusta: int
    comentarios: int
    compartidos: int
    reproducciones: int
    fecha_reporte: datetime
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Estadísticas ────────────────────────────────────────────────────────────

class EstadisticaEstado(BaseModel):
    estado: str
    total: int

class EstadisticaSistema(BaseModel):
    sistema: str
    total: int

class EstadisticaResumen(BaseModel):
    total_reportes: int
    total_operadores: int
    estados: List[EstadisticaEstado]
    sistemas: List[EstadisticaSistema]


# ─── Audit ───────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    usuario_id: Optional[int] = None
    accion: str
    tabla: Optional[str] = None
    registro_id: Optional[int] = None
    descripcion: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    class Config:
        from_attributes = True
