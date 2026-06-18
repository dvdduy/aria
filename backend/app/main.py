from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler  # type: ignore[attr-defined]
from slowapi.errors import RateLimitExceeded

from app.api import agent, auth, employees, health, leave, notifications, payroll, policies
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.core.seed import seed_dev_data

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.app_env == "development":
        db = SessionLocal()
        try:
            seed_dev_data(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Aria - AI HR Workflow Agent",
    version=settings.app_version,
    docs_url="/docs" if settings.app_env == "development" else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["system"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(leave.router, prefix="/api/leave", tags=["leave"])
app.include_router(policies.router, prefix="/api/policies", tags=["policies"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["payroll"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
