import redis

from app.core.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True)


def check_redis_connection() -> bool:
    try:
        redis_client.ping()
        return True
    except Exception:
        return False
