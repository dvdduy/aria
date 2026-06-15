from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
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

    class Config:
        env_file = ".env"
        populate_by_name = True


settings = Settings()
