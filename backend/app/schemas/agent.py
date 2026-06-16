
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatEnqueueResponse(BaseModel):
    job_id: str
    session_id: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # pending | done | failed


class JobResultResponse(BaseModel):
    job_id: str
    result: str
