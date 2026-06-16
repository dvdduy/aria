import json

from app.api import agent as agent_api
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.tasks.agent_task import FRIENDLY_AGENT_FAILURE_MESSAGE


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.expirations = {}

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, ex=None):
        self.values[key] = value
        self.expirations[key] = ex
        return True


class FakeTask:
    id = "job-123"


def fake_delay(*args, **kwargs):
    return FakeTask()


def test_chat_returns_job_id_and_generated_session_id(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    captured = {}

    def fake_delay_with_capture(message, session_id, user_id):
        captured["message"] = message
        captured["session_id"] = session_id
        captured["user_id"] = user_id
        return FakeTask()

    monkeypatch.setattr(agent_api, "redis_client", fake_redis)
    monkeypatch.setattr(agent_api.run_agent_task, "delay", fake_delay_with_capture)

    response = client.post(
        "/api/agent/chat",
        headers=_auth_headers(user),
        json={"message": "Please review my leave requests"},
    )

    body = response.json()
    assert response.status_code == 200
    assert body["job_id"] == "job-123"
    assert body["session_id"]
    assert captured == {
        "message": "Please review my leave requests",
        "session_id": body["session_id"],
        "user_id": str(user.id),
    }


def test_chat_preserves_provided_session_id(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    captured = {}

    def fake_delay_with_capture(message, session_id, user_id):
        captured["session_id"] = session_id
        return FakeTask()

    monkeypatch.setattr(agent_api, "redis_client", fake_redis)
    monkeypatch.setattr(agent_api.run_agent_task, "delay", fake_delay_with_capture)

    response = client.post(
        "/api/agent/chat",
        headers=_auth_headers(user),
        json={"message": "hello", "session_id": "session-abc"},
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "session_id": "session-abc"}
    assert captured["session_id"] == "session-abc"


def test_chat_requires_authentication(client):
    response = client.post("/api/agent/chat", json={"message": "hello"})

    assert response.status_code == 403


def test_chat_stores_job_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)
    monkeypatch.setattr(agent_api.run_agent_task, "delay", fake_delay)

    response = client.post(
        "/api/agent/chat",
        headers=_auth_headers(user),
        json={"message": "hello"},
    )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-123"
    assert fake_redis.get("job:job-123:user_id") == str(user.id)
    assert fake_redis.expirations["job:job-123:user_id"] == agent_api.JOB_TTL_SECONDS


def test_job_status_allows_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "done")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/status/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "status": "done"}


def test_job_status_returns_pending_for_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "pending")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/status/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "status": "pending"}


def test_job_status_returns_failed_for_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "failed")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/status/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "status": "failed"}


def test_job_status_defaults_to_pending_when_status_missing(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/status/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "status": "pending"}


def test_job_status_requires_authentication(client):
    response = client.get("/api/agent/status/job-123")

    assert response.status_code == 403


def test_job_status_hides_non_owner_job(client, db, monkeypatch):
    owner = _create_user(db, "owner@example.com")
    other_user = _create_user(db, "other@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(owner.id))
    fake_redis.set("job:job-123:status", "done")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/status/job-123",
        headers=_auth_headers(other_user),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def test_job_result_allows_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:result", "Done")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/result/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "result": "Done", "tool_trace": []}


def test_job_result_returns_tool_trace_for_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    trace = [
        {
            "tool": "list_team_leave",
            "status": "success",
            "summary": "leave_requests:1",
            "error_code": None,
        }
    ]
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:result", "Done")
    fake_redis.set("job:job-123:tool_trace", json.dumps(trace))
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/result/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {
        "job_id": "job-123",
        "result": "Done",
        "tool_trace": trace,
    }


def test_job_result_defaults_tool_trace_to_empty_list_for_invalid_json(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:result", "Done")
    fake_redis.set("job:job-123:tool_trace", "not-json")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/result/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "result": "Done", "tool_trace": []}


def test_job_result_returns_friendly_failed_message_for_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "failed")
    fake_redis.set("job:job-123:result", FRIENDLY_AGENT_FAILURE_MESSAGE)
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/result/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    assert response.json() == {
        "job_id": "job-123",
        "result": FRIENDLY_AGENT_FAILURE_MESSAGE,
        "tool_trace": [],
    }


def test_job_result_hides_non_owner_job(client, db, monkeypatch):
    owner = _create_user(db, "owner@example.com")
    other_user = _create_user(db, "other@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(owner.id))
    fake_redis.set("job:job-123:result", "Done")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/result/job-123",
        headers=_auth_headers(other_user),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def test_job_status_returns_404_when_owner_key_missing(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:status", "done")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/status/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def test_job_result_returns_404_when_owner_key_missing(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:result", "Done")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get(
        "/api/agent/result/job-123",
        headers=_auth_headers(user),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def _create_user(db, email: str) -> User:
    user = User(email=email, hashed_password=hash_password("password"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"Authorization": f"Bearer {token}"}
