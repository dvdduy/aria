from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", populate_by_name=True)

    # App
    app_env: str = Field("development", alias="APP_ENV")
    app_version: str = Field("0.1.0", alias="APP_VERSION")
    cors_origins: str = Field("http://localhost:5173", alias="CORS_ORIGINS")

    # Database
    database_url: str = Field(..., alias="DATABASE_URL")

    # Redis
    redis_url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")

    # Auth
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_expire_hours: int = Field(8, alias="JWT_EXPIRE_HOURS")

    # LLM
    anthropic_api_key: str = Field(..., alias="ANTHROPIC_API_KEY")
    llm_model: str = Field("claude-sonnet-4-6", alias="LLM_MODEL")
    llm_max_tokens: int = Field(4096, alias="LLM_MAX_TOKENS")

    # Agent
    agent_max_iterations: int = Field(10, alias="AGENT_MAX_ITERATIONS")
    agent_timeout_seconds: int = Field(30, alias="AGENT_TIMEOUT_SECONDS")

    # TLS — set SSL_VERIFY=false for local Docker behind corporate TLS inspection
    ssl_verify: bool = Field(True, alias="SSL_VERIFY")


settings = Settings()  # type: ignore[call-arg]
