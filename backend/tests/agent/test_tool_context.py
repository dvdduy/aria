from app.agent.tools.context import build_tool_context
from app.models.employee import Employee
from app.models.user import User


def test_build_tool_context_includes_user_and_employee(db):
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = build_tool_context(db, user)

    assert context.user.id == user.id
    assert context.employee is not None
    assert context.employee.id == employee.id
    assert context.is_admin is False


def test_build_tool_context_marks_admin(db):
    user = User(
        email="admin@example.com",
        hashed_password="hashed",
        is_admin=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = build_tool_context(db, user)

    assert context.user.id == user.id
    assert context.is_admin is True


def test_build_tool_context_allows_unlinked_user(db):
    user = User(
        email="unlinked@example.com",
        hashed_password="hashed",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = build_tool_context(db, user)

    assert context.user.id == user.id
    assert context.employee is None
