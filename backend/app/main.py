from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import configure_logging
from app.api import auth, agent, employees, leave, policies, payroll, health

configure_logging()

app = FastAPI(
    title="Aria - AI HR Workflow Agent",
    version=settings.app_version,
    docs_url="/docs" if settings.app_env == "development" else None,
)

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
