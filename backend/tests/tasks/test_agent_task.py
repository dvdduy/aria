import pytest

from app.tasks import agent_task


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


class RetryCalled(Exception):
    pass


def fake_retry(exc, countdown):
    raise RetryCalled from exc


def test_run_agent_task_stores_done_result(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(agent_task, "redis_client", fake_redis)
    monkeypatch.setattr(agent_task, "execute_agent_job", lambda **kwargs: "Done")

    agent_task.run_agent_task_body(
        job_id="job-123",
        message="hello",
        session_id="session-123",
        user_id="user-123",
        retry=fake_retry,
    )

    assert fake_redis.get("job:job-123:status") == "done"
    assert fake_redis.get("job:job-123:result") == "Done"
    assert fake_redis.expirations["job:job-123:status"] == agent_task.JOB_TTL_SECONDS
    assert fake_redis.expirations["job:job-123:result"] == agent_task.JOB_TTL_SECONDS


def test_run_agent_task_stores_friendly_failure_message(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(agent_task, "redis_client", fake_redis)

    def failing_execute_agent_job(**kwargs):
        raise RuntimeError("sensitive stack detail")

    monkeypatch.setattr(agent_task, "execute_agent_job", failing_execute_agent_job)

    with pytest.raises(RetryCalled):
        agent_task.run_agent_task_body(
            job_id="job-123",
            message="hello",
            session_id="session-123",
            user_id="user-123",
            retry=fake_retry,
        )

    assert fake_redis.get("job:job-123:status") == "failed"
    assert fake_redis.get("job:job-123:result") == agent_task.FRIENDLY_AGENT_FAILURE_MESSAGE
    assert "sensitive stack detail" not in fake_redis.get("job:job-123:result")
    assert fake_redis.expirations["job:job-123:status"] == agent_task.JOB_TTL_SECONDS
    assert fake_redis.expirations["job:job-123:result"] == agent_task.JOB_TTL_SECONDS
