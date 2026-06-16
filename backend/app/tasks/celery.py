from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "aria",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.agent_task"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=300,  # 5 minutes
)
