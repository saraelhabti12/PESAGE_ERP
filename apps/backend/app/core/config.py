from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "ERP Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", validation_alias="APP_ENV")
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str = "postgresql://erp_user:erp_password@localhost:5432/erp_db"

    SECRET_KEY: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_KEY_FOR_DEVELOPMENT"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "CHANGE_THIS_PASSWORD"

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = ""

    MAIL_HOST: str = "localhost"
    MAIL_PORT: int = 1025

    OPENAI_API_KEY: str = ""

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                return []
            import json
            if trimmed.startswith("[") and trimmed.endswith("]"):
                try:
                    parsed = json.loads(trimmed)
                    if isinstance(parsed, list):
                        return [str(i).rstrip("/").strip() for i in parsed if str(i).strip()]
                except Exception:
                    pass
            return [i.rstrip("/").strip() for i in trimmed.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i).rstrip("/").strip() for i in v if str(i).strip()]
        return v

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def assemble_redis_url(cls, v: str, info) -> str:
        if v and v.strip():
            return v
        host = info.data.get("REDIS_HOST", "localhost")
        port = info.data.get("REDIS_PORT", 6379)
        return f"redis://{host}:{port}/0"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()