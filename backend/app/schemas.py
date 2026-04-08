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
    telefono: Optional[str] = None
    role: str = "operador"
    indicativo: Optional[str] = None

    @field_validator("email", "telefono", "indicativo", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        return None if v == "" else v

class UsuarioUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    role: Optional[str] = None
    indicativo: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("email", "telefono", "indicativo", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        return None if v == "" else v

class UsuarioOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    telefono: Optional[str] = None
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
    color: Optional[str] = "#1677ff"
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
    zona: Optional[str] = None
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
    capturado_por: Optional[int] = None
    capturado_por_nombre: Optional[str] = None

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


# ─── Libreta config ──────────────────────────────────────────────────────────

class LibretaConfigOut(BaseModel):
    tipo_evento: Optional[str] = None
    estacion: Optional[str] = None
    sistema_default: Optional[str] = None
    considerar_swl: bool = False
    estado_default: Optional[str] = None
    ciudad_default: Optional[str] = None
    rst_default: Optional[str] = "59"
    anunciar_primera_vez: bool = False
    anunciar_reaparicion: bool = False
    class Config:
        from_attributes = True

class LibretaConfigUpdate(BaseModel):
    tipo_evento: Optional[str] = None
    estacion: Optional[str] = None
    sistema_default: Optional[str] = None
    considerar_swl: bool = False
    estado_default: Optional[str] = None
    ciudad_default: Optional[str] = None
    rst_default: Optional[str] = "59"
    anunciar_primera_vez: bool = False
    anunciar_reaparicion: bool = False

class NuevoHamCreate(BaseModel):
    indicativo: str
    nombre_completo: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None

class RecordatorioConfig(BaseModel):
    dias_reaparicion: int = 30


# ─── Configuración ───────────────────────────────────────────────────────────

class SmtpConfig(BaseModel):
    host: str = ""
    port: int = 587
    usuario: str = ""
    password: str = ""
    remitente: str = ""
    ssl: bool = False          # True = SSL/TLS puro (465), False = STARTTLS (587)
    habilitado: bool = False

class SmtpTestRequest(BaseModel):
    destinatario: str


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
