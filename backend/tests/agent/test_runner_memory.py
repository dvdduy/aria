import uuid

from app.agent.runner import AgentRunner
from app.models.agent_memory import AgentMemory
from app.models.user import User


class TextBlock:
    text = "Hello back"


class EndTurnResponse:
    stop_reason = "end_turn"
    content = [TextBlock()]


class FakeMessages:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return EndTurnResponse()


class FakeClient:
    def __init__(self):
        self.messages = FakeMessages()


def test_save_to_memory_persists_user_and_assistant_turns(db):
    runner = AgentRunner()
    session_id = uuid.uuid4()
    user = _create_user(db, "user@example.com")

    runner._save_to_memory(str(session_id), str(user.id), "user", "Hello", db)
    runner._save_to_memory(str(session_id), str(user.id), "assistant", "Hi", db)

    history = runner._load_history(str(session_id), str(user.id), db)

    assert history == [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi"},
    ]


def test_load_history_does_not_cross_users(db):
    runner = AgentRunner()
    session_id = uuid.uuid4()
    first_user = _create_user(db, "first@example.com")
    second_user = _create_user(db, "second@example.com")

    runner._save_to_memory(str(session_id), str(first_user.id), "user", "First", db)
    runner._save_to_memory(str(session_id), str(second_user.id), "user", "Second", db)

    history = runner._load_history(str(session_id), str(first_user.id), db)

    assert history == [{"role": "user", "content": "First"}]


def test_load_history_does_not_cross_sessions(db):
    runner = AgentRunner()
    first_session_id = uuid.uuid4()
    second_session_id = uuid.uuid4()
    user = _create_user(db, "user@example.com")

    runner._save_to_memory(str(first_session_id), str(user.id), "user", "First", db)
    runner._save_to_memory(str(second_session_id), str(user.id), "user", "Second", db)

    history = runner._load_history(str(first_session_id), str(user.id), db)

    assert history == [{"role": "user", "content": "First"}]


def test_runner_saves_current_user_and_assistant_turns(db):
    runner = AgentRunner()
    runner.client = FakeClient()
    session_id = uuid.uuid4()
    user = _create_user(db, "user@example.com")

    result = runner.run(
        message="Hello",
        session_id=str(session_id),
        user_id=str(user.id),
        db=db,
    )

    records = (
        db.query(AgentMemory)
        .filter_by(session_id=session_id, user_id=user.id)
        .order_by(AgentMemory.created_at)
        .all()
    )

    assert result == {"message": "Hello back", "tool_trace": []}
    assert [(record.role, record.content) for record in records] == [
        ("user", "Hello"),
        ("assistant", "Hello back"),
    ]
    assert runner.client.messages.calls[0]["messages"] == [
        {"role": "user", "content": "Hello"}
    ]


def _create_user(db, email: str) -> User:
    user = User(email=email, hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
