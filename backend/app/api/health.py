from fastapi import APIRouter

from app.core.config import settings
from app.core.database import check_db_connection
from app.core.redis import check_redis_connection

router = APIRouter()


@router.get("/health")
def health():
    db_ok = check_db_connection()
    redis_ok = check_redis_connection()
    status = "healthy" if db_ok and redis_ok else "degraded"
    return {
        "status": status,
        "version": settings.app_version,
        "checks": {"database": db_ok, "redis": redis_ok},
    }
