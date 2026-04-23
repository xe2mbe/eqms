from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text,
    ForeignKey, BigInteger, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, nullable=True)
    role = Column(String(20), nullable=False, default="operador")  # admin | operador
    indicativo = Column(String(20), nullable=True)
    telefono = Column(String(30), nullable=True)
    avatar = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=True)
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reportes = relationship("Reporte", back_populates="capturado_por_usuario", foreign_keys="Reporte.capturado_por")
    audit_logs = relationship("AuditLog", back_populates="usuario")


class Evento(Base):
    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(80), nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    color = Column(String(20), nullable=True, default="#1677ff")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Estacion(Base):
    __tablename__ = "estaciones"

    id = Column(Integer, primary_key=True, index=True)
    qrz = Column(String(20), unique=True, nullable=False, index=True)
    descripcion = Column(Text, nullable=True)
    color = Column(String(20), nullable=True, default="#1677ff")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Zona(Base):
    __tablename__ = "zonas"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(20), unique=True, nullable=False)
    nombre = Column(String(80), nullable=False)
    color = Column(String(20), nullable=True, default="#1677ff")
    is_active = Column(Boolean, default=True)


class Sistema(Base):
    __tablename__ = "sistemas"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(20), unique=True, nullable=False)
    nombre = Column(String(80), nullable=False)
    color = Column(String(20), nullable=True, default="#1677ff")
    is_active = Column(Boolean, default=True)


class Estado(Base):
    __tablename__ = "estados"

    id = Column(Integer, primary_key=True, index=True)
    abreviatura = Column(String(10), unique=True, nullable=False)
    nombre = Column(String(80), nullable=False)
    zona = Column(String(20), nullable=True)   # XE1 | XE2 | XE3 | XE4 | XE5
    lat = Column(String(20), nullable=True)
    lng = Column(String(20), nullable=True)


class Reporte(Base):
    __tablename__ = "reportes"

    id = Column(Integer, primary_key=True, index=True)
    indicativo = Column(String(20), nullable=False, index=True)
    operador = Column(String(120), nullable=True)
    senal = Column(Integer, default=59)
    estado = Column(String(80), nullable=True, index=True)
    ciudad = Column(String(80), nullable=True)
    zona = Column(String(20), nullable=True, index=True)
    pais = Column(String(80), nullable=True, index=True)
    sistema = Column(String(20), nullable=True, index=True)
    tipo_reporte = Column(String(80), nullable=True, index=True)
    qrz_station = Column(String(20), nullable=True)
    capturado_por = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_reporte = Column(DateTime(timezone=True), nullable=False, index=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    capturado_por_usuario = relationship("Usuario", back_populates="reportes", foreign_keys=[capturado_por])

    __table_args__ = (
        Index("ix_reportes_fecha_tipo", "fecha_reporte", "tipo_reporte"),
        Index("ix_reportes_fecha_sistema", "fecha_reporte", "sistema"),
        Index("ix_reportes_indicativo_fecha", "indicativo", "fecha_reporte"),
    )


class PlataformaRS(Base):
    __tablename__ = "plataformas_rs"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), unique=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    estadisticas = relationship("EstadisticaRS", back_populates="plataforma")
    metricas = relationship("MetricaRS", back_populates="plataforma", cascade="all, delete-orphan")
    reportes_rs = relationship("ReporteRS", back_populates="plataforma")


class MetricaRS(Base):
    """Métricas configurables por plataforma (me_gusta, comentarios, personalizadas)."""
    __tablename__ = "metricas_rs"

    id = Column(Integer, primary_key=True, index=True)
    plataforma_id = Column(Integer, ForeignKey("plataformas_rs.id"), nullable=False, index=True)
    nombre = Column(String(80), nullable=False)
    slug = Column(String(80), nullable=False)        # clave usada en el JSON de valores
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)      # True = viene preinstalada
    orden = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plataforma = relationship("PlataformaRS", back_populates="metricas")


class EstadisticaRS(Base):
    __tablename__ = "estadisticas_rs"

    id = Column(Integer, primary_key=True, index=True)
    plataforma_id = Column(Integer, ForeignKey("plataformas_rs.id"), nullable=False, index=True)
    valores = Column(JSONB, nullable=False, default=dict)   # {"me_gusta": 100, "comentarios": 50}
    fecha_reporte = Column(DateTime(timezone=True), nullable=False, index=True)
    capturado_por = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plataforma = relationship("PlataformaRS", back_populates="estadisticas")


class ReporteRS(Base):
    """Registro de estaciones que reportan via Redes Sociales (equivalente a Reporte en RF)."""
    __tablename__ = "reportes_rs"

    id = Column(Integer, primary_key=True, index=True)
    indicativo = Column(String(20), nullable=False, index=True)
    operador = Column(String(120), nullable=True)
    senal = Column(Integer, default=59)
    plataforma_id = Column(Integer, ForeignKey("plataformas_rs.id"), nullable=False, index=True)
    estado = Column(String(80), nullable=True, index=True)
    ciudad = Column(String(80), nullable=True)
    zona = Column(String(20), nullable=True, index=True)
    pais = Column(String(80), nullable=True)
    tipo_reporte = Column(String(80), nullable=True, index=True)
    qrz_station = Column(String(20), nullable=True)
    url_publicacion = Column(Text, nullable=True)
    capturado_por = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_reporte = Column(DateTime(timezone=True), nullable=False, index=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    plataforma = relationship("PlataformaRS", back_populates="reportes_rs")


class Radioexperimentador(Base):
    __tablename__ = "radioexperimentadores"

    id = Column(Integer, primary_key=True, index=True)
    indicativo = Column(String(20), unique=True, nullable=False, index=True)
    nombre_completo = Column(String(150), nullable=True)
    municipio = Column(String(100), nullable=True)
    estado = Column(String(100), nullable=True)
    pais = Column(String(80), nullable=True, default="México")
    tipo_licencia = Column(String(20), nullable=True)
    tipo_ham = Column(String(20), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ConfiguracionSistema(Base):
    """Almacén clave-valor para configuración del sistema."""
    __tablename__ = "configuracion_sistema"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(80), unique=True, nullable=False, index=True)
    valor = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PrefijoPais(Base):
    """Tabla de prefijos de indicativos de radioaficionados y su país/zona."""
    __tablename__ = "prefijos_pais"

    id = Column(Integer, primary_key=True, index=True)
    prefijo = Column(String(10), unique=True, nullable=False, index=True)
    pais = Column(String(80), nullable=False)
    zona_codigo = Column(String(20), nullable=True)   # ej. XE1, XE2 — NULL = Extranjero


class LibretaConfigUsuario(Base):
    """Configuración de libreta guardada por usuario."""
    __tablename__ = "libreta_config_usuario"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True, nullable=False)
    tipo_evento = Column(String(80), nullable=True)
    estacion = Column(String(20), nullable=True)
    sistema_default = Column(String(20), nullable=True)
    considerar_swl = Column(Boolean, default=False)
    estado_default = Column(String(80), nullable=True)
    ciudad_default = Column(String(80), nullable=True)
    rst_default = Column(String(3), nullable=True, default="59")
    anunciar_primera_vez = Column(Boolean, default=False)
    anunciar_reaparicion = Column(Boolean, default=False)
    zona_swl_default = Column(String(20), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    usuario = relationship("Usuario", backref="libreta_config")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    accion = Column(String(50), nullable=False)   # CREATE | UPDATE | DELETE | LOGIN | LOGOUT
    tabla = Column(String(50), nullable=True)
    registro_id = Column(Integer, nullable=True)
    descripcion = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    usuario = relationship("Usuario", back_populates="audit_logs")
