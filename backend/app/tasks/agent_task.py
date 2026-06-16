from app.core.logging import logger
from app.core.redis import redis_client
from app.tasks.celery import celery_app


@celery_app.task(bind=True, acks_late=True, max_retries=2)
def run_agent_task(self, message: str, session_id: str, user_id: str):
    job_id = self.request.id
    redis_client.set(f"job:{job_id}:status", "pending", ex=300)

    try:
        # Lazy import to avoid circular deps
        from app.agent.runner import AgentRunner
        from app.core.database import SessionLocal

        with SessionLocal() as db:
            runner = AgentRunner()
            result = runner.run(message=message, session_id=session_id, user_id=user_id, db=db)

        redis_client.set(f"job:{job_id}:status", "done", ex=300)
        redis_client.set(f"job:{job_id}:result", result, ex=300)
        logger.info("agent_task_completed", job_id=job_id, session_id=session_id)

    except Exception as exc:
        logger.error("agent_task_failed", job_id=job_id, error=str(exc))
        redis_client.set(f"job:{job_id}:status", "failed", ex=300)
        redis_client.set(
            f"job:{job_id}:result",
            "Something went wrong. Please try again.",
            ex=300,
        )
        raise self.retry(exc=exc, countdown=5) from exc
