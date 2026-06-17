import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import redis_client
from app.models.agent_memory import AgentMemory
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
    return {
        "job_id": job_id,
        "result": result,
        "tool_trace": _get_job_tool_trace(job_id),
    }


@router.get("/sessions")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = (
        db.query(AgentMemory)
        .filter(AgentMemory.user_id == current_user.id)
        .order_by(AgentMemory.session_id, AgentMemory.created_at)
        .all()
    )

    by_session: dict[str, list] = {}
    for r in records:
        sid = str(r.session_id)
        by_session.setdefault(sid, []).append(r)

    sessions = []
    for sid, rows in by_session.items():
        preview = None
        last_at = rows[0].created_at
        for r in rows:
            last_at = r.created_at
            if r.role == "user" and preview is None:
                try:
                    parsed = json.loads(r.content)
                    if isinstance(parsed, (list, dict)):
                        continue
                    text = str(parsed).strip()
                except (json.JSONDecodeError, ValueError):
                    text = r.content.strip()
                if text:
                    preview = text[:100]

        if preview:
            sessions.append({
                "session_id": sid,
                "preview": preview,
                "started_at": rows[0].created_at.isoformat(),
                "last_message_at": last_at.isoformat(),
            })

    sessions.sort(key=lambda s: s["last_message_at"], reverse=True)
    return sessions


@router.get("/history/{session_id}")
def get_chat_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = (
        db.query(AgentMemory)
        .filter(
            AgentMemory.session_id == session_id,
            AgentMemory.user_id == current_user.id,
        )
        .order_by(AgentMemory.created_at)
        .all()
    )
    messages = []
    for r in records:
        if r.role not in ("user", "assistant"):
            continue
        try:
            parsed = json.loads(r.content)
            # Skip internal tool blocks (lists) and tool result dicts
            if isinstance(parsed, (list, dict)):
                continue
            text = str(parsed)
        except (json.JSONDecodeError, ValueError):
            text = r.content
        if text.strip():
            messages.append({"role": r.role, "content": text})
    return messages


def _authorize_job_access(job_id: str, current_user: User) -> None:
    owner_id = redis_client.get(f"job:{job_id}:user_id")
    if owner_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )


def _get_job_tool_trace(job_id: str) -> list[dict]:
    raw_trace = redis_client.get(f"job:{job_id}:tool_trace")
    if not raw_trace:
        return []
    try:
        trace = json.loads(raw_trace)
    except json.JSONDecodeError:
        return []
    return trace if isinstance(trace, list) else []
