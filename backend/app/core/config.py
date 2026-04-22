"""
Configuración central de la aplicación usando pydantic-settings.
Los valores se cargan automáticamente desde variables de entorno o archivo .env.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Base de datos ──────────────────────────────────────────────────────────
    database_url: str

    # ── Redis ──────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── WhatsApp / Meta ────────────────────────────────────────────────────────
    whatsapp_verify_token: str
    whatsapp_app_secret: str
    whatsapp_access_token: str
    whatsapp_phone_number_id: str

    # ── Seguridad ──────────────────────────────────────────────────────────────
    secret_key: str = "insecure-default-change-me"

    # ── Entorno ────────────────────────────────────────────────────────────────
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Instancia global — importar desde aquí en toda la app
settings = Settings()
