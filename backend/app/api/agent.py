import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.core.redis import redis_client
from app.models.user import User
from app.schemas.agent import ChatEnqueueResponse, ChatRequest, JobResultResponse, JobStatusResponse
from app.tasks.agent_task import run_agent_task

router = APIRouter()
JOB_TTL_SECONDS = 300


@router.post("/chat", response_model=ChatEnqueueResponse)
def chat(payload: ChatRequest, current_user: User = Depends(get_current_user)):
    session_id = payload.session_id or str(uuid.uuid4())
    task = run_agent_task.delay(payload.message, session_id, str(current_user.id))
    redis_client.set(
        f"job:{task.id}:user_id",
        str(current_user.id),
        ex=JOB_TTL_SECONDS,
    )
    return {"job_id": task.id, "session_id": session_id}


@router.get("/status/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str, current_user: User = Depends(get_current_user)):
    _authorize_job_access(job_id, current_user)
    status = redis_client.get(f"job:{job_id}:status") or "pending"
    return {"job_id": job_id, "status": status}


@router.get("/result/{job_id}", response_model=JobResultResponse)
def job_result(job_id: str, current_user: User = Depends(get_current_user)):
    _authorize_job_access(job_id, current_user)
    result = redis_client.get(f"job:{job_id}:result") or ""
    return {"job_id": job_id, "result": result}


def _authorize_job_access(job_id: str, current_user: User) -> None:
    owner_id = redis_client.get(f"job:{job_id}:user_id")
    if owner_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
