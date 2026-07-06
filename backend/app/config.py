from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import List

# Valores de SECRET_KEY que aparecen como placeholder en el código o en .env.example.
# Si alguno de estos llega a producción (DEBUG=False) el arranque debe fallar en vez
# de firmar JWT con una clave que cualquiera puede leer en el repo.
_INSECURE_SECRET_KEYS = {
    "cambia-esta-clave-en-produccion",
    "cambia-esta-clave-secreta-por-una-segura-de-32-chars",
}


class Settings(BaseSettings):
    # Base de datos
    DATABASE_URL: str = "postgresql://quser:qpassword@localhost:5432/qmsdb"

    # JWT
    SECRET_KEY: str = "cambia-esta-clave-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    APP_NAME: str = "QMS - FMRE"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    UPLOADS_DIR: str = "/app/uploads"

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@fmre.org"

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @model_validator(mode="after")
    def _validar_secret_key_en_produccion(self):
        # Con DEBUG=True (dev local) se permite la clave de ejemplo. Con DEBUG=False
        # (el default ahora, y lo esperado en producción) se exige una clave real.
        if not self.DEBUG:
            insegura = self.SECRET_KEY in _INSECURE_SECRET_KEYS or len(self.SECRET_KEY) < 32
            if insegura:
                raise RuntimeError(
                    "SECRET_KEY insegura o de ejemplo con DEBUG=False. Define una SECRET_KEY "
                    "única de al menos 32 caracteres en el .env antes de arrancar en producción."
                )
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
