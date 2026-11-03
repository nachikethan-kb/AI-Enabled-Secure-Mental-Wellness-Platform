import json
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Healthly API"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change_me"  # JWT signing only
    data_encryption_key: str = ""  # Fernet key for data at rest (independent of SECRET_KEY)
    max_patients_per_doctor: int = 1  # 1 = strict one-to-one
    max_credential_pdf_bytes: int = 5 * 1024 * 1024
    access_token_expire_minutes: int = 60
    database_url: str = "sqlite:///./healthly.db"
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    webhook_secret: str = "change_me_webhook_secret"
    n8n_webhook_url: str = "http://localhost:5678"
    redis_url: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        value = (self.cors_origins or "").strip()
        if not value:
            return ["http://localhost:5173"]

        if value.startswith("["):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                pass

        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
