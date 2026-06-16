from app.core.logging import logger
from app.core.redis import redis_client
from app.tasks.celery import celery_app

FRIENDLY_AGENT_FAILURE_MESSAGE = "Something went wrong. Please try again."
JOB_TTL_SECONDS = 300


@celery_app.task(bind=True, acks_late=True, max_retries=2)
def run_agent_task(self, message: str, session_id: str, user_id: str):
    job_id = self.request.id
    return run_agent_task_body(
        job_id=job_id,
        message=message,
        session_id=session_id,
        user_id=user_id,
        retry=self.retry,
    )


def run_agent_task_body(
    job_id: str,
    message: str,
    session_id: str,
    user_id: str,
    retry,
):
    redis_client.set(f"job:{job_id}:status", "pending", ex=JOB_TTL_SECONDS)

    try:
        result = execute_agent_job(message=message, session_id=session_id, user_id=user_id)

        redis_client.set(f"job:{job_id}:status", "done", ex=JOB_TTL_SECONDS)
        redis_client.set(f"job:{job_id}:result", result, ex=JOB_TTL_SECONDS)
        logger.info("agent_task_completed", job_id=job_id, session_id=session_id)

    except Exception as exc:
        logger.error("agent_task_failed", job_id=job_id, error=str(exc))
        redis_client.set(f"job:{job_id}:status", "failed", ex=JOB_TTL_SECONDS)
        redis_client.set(
            f"job:{job_id}:result",
            FRIENDLY_AGENT_FAILURE_MESSAGE,
            ex=JOB_TTL_SECONDS,
        )
        raise retry(exc=exc, countdown=5) from exc


def execute_agent_job(message: str, session_id: str, user_id: str) -> str:
    # Lazy imports avoid circular dependencies during worker startup.
    from app.agent.runner import AgentRunner
    from app.core.database import SessionLocal

    with SessionLocal() as db:
        runner = AgentRunner()
        return runner.run(message=message, session_id=session_id, user_id=user_id, db=db)
