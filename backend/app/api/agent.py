import uuid

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.core.redis import redis_client
from app.models.user import User
from app.schemas.agent import ChatEnqueueResponse, ChatRequest, JobResultResponse, JobStatusResponse
from app.tasks.agent_task import run_agent_task

router = APIRouter()


@router.post("/chat", response_model=ChatEnqueueResponse)
def chat(payload: ChatRequest, current_user: User = Depends(get_current_user)):
    session_id = payload.session_id or str(uuid.uuid4())
    task = run_agent_task.delay(payload.message, session_id, str(current_user.id))
    return {"job_id": task.id, "session_id": session_id}


@router.get("/status/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str, current_user: User = Depends(get_current_user)):
    status = redis_client.get(f"job:{job_id}:status") or "pending"
    return {"job_id": job_id, "status": status}


@router.get("/result/{job_id}", response_model=JobResultResponse)
def job_result(job_id: str, current_user: User = Depends(get_current_user)):
    result = redis_client.get(f"job:{job_id}:result") or ""
    return {"job_id": job_id, "result": result}
