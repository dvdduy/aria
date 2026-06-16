# E5-S4 Payroll Agent Access Control

**Story:** As an employee, agent tools cannot read another employee's payroll.  
**Epic:** E5 - Safe Agent Tools  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

Payroll is the most sensitive data area in the current product plan. Before the payroll tool becomes useful in chat, the backend must prove a strict access rule:

```text
the agent payroll tool can read only the authenticated employee's own payroll records
```

The model must not be able to provide an `employee_id` and retrieve someone else's salary data.

## Current State

Already implemented:

- `ToolContext` provides trusted `user` and linked `employee`.
- `dispatch_tool(...)` passes context to all agent tools.
- Employee and leave read tools already ignore model-supplied employee identity.
- `PayrollRecord` model exists.
- `get_payroll_summary` agent tool exists as a `not_implemented` stub.

Missing:

- payroll service functions,
- payroll agent tool implementation,
- payroll access-control tests,
- safer payroll tool definition.

Current risk:

- `get_payroll_summary` tool definition still requires model-supplied `employee_id`.
- Without tests, future implementation could accidentally trust that `employee_id`.

## Recommended Scope

Implement `get_payroll_summary` as a self-service, read-only tool.

For this story:

- return payroll records for `context.employee`,
- ignore model-supplied `employee_id`,
- optionally accept a simple `period` filter,
- return `profile_not_linked` if the user has no employee profile,
- return an empty list if the current employee has no payroll records,
- do not implement admin payroll lookup,
- do not implement manager payroll lookup,
- do not implement payroll writes.

## Response Shape

Recommended success response:

```json
{
  "tool": "get_payroll_summary",
  "payroll_records": [
    {
      "id": "...",
      "employee_id": "...",
      "period_start": "2026-05-01",
      "period_end": "2026-05-31",
      "gross_salary": "7500.00",
      "net_salary": "5200.00",
      "currency": "CAD"
    }
  ]
}
```

Recommended unlinked response:

```json
{
  "error": "profile_not_linked",
  "tool": "get_payroll_summary",
  "message": "Your user account is not linked to an employee profile."
}
```

Use strings for decimal values in tool output. That avoids float rounding surprises and mirrors how financial data is often serialized.

## TDD Plan

Create:

```text
backend/tests/agent/test_payroll_tools.py
```

### Step 1 - Returns Current Employee Payroll

Test shape:

```python
def test_get_payroll_summary_returns_context_employee_records(db):
    # create current employee
    # create other employee
    # create payroll record for each

    result = get_payroll_summary(
        db,
        context,
        employee_id=str(other_employee.id),
    )

    assert result["tool"] == "get_payroll_summary"
    assert len(result["payroll_records"]) == 1
    assert result["payroll_records"][0]["employee_id"] == str(employee.id)
```

Important assertion:

- pass another employee's `employee_id` and prove it is ignored.

Expected red result:

```text
assert 'not_implemented' == ...
```

### Step 2 - Returns Empty List

Test:

```python
def test_get_payroll_summary_returns_empty_list_when_no_records(db):
    result = get_payroll_summary(db, context)

    assert result["payroll_records"] == []
```

### Step 3 - Handles Unlinked User

Test:

```python
def test_get_payroll_summary_returns_profile_not_linked_for_unlinked_user(db):
    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_payroll_summary(db, context)

    assert result["error"] == "profile_not_linked"
```

### Step 4 - Optional Period Filter

If adding period filtering in this story, keep it simple:

```python
def test_get_payroll_summary_filters_by_period_text(db):
    result = get_payroll_summary(db, context, period="May 2026")

    assert len(result["payroll_records"]) == 1
```

Recommendation: defer fuzzy period parsing unless needed. A simple `period_start` / `period_end` filter is cleaner later. For this story, allowing `period` but ignoring it is acceptable if the tool description says records are returned for the current employee.

## Implementation Plan

### Step 1 - Add Payroll Service

Create:

```text
backend/app/services/payroll_service.py
```

Recommended function:

```python
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.payroll import PayrollRecord


def list_payroll_records_for_employee(
    db: Session,
    employee: Employee,
) -> list[PayrollRecord]:
    return (
        db.query(PayrollRecord)
        .filter(PayrollRecord.employee_id == employee.id)
        .order_by(PayrollRecord.period_start.desc())
        .all()
    )
```

Keep the service intentionally small. More advanced period filtering can come in `E7`.

### Step 2 - Implement Payroll Tool

In `backend/app/agent/tools/payroll_tools.py`:

```python
from app.models.payroll import PayrollRecord
from app.services.payroll_service import list_payroll_records_for_employee
```

Add:

```python
def get_payroll_summary(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("get_payroll_summary")

    records = list_payroll_records_for_employee(db, context.employee)
    return {
        "tool": "get_payroll_summary",
        "payroll_records": [_serialize_payroll_record(record) for record in records],
    }
```

Serializer:

```python
def _serialize_payroll_record(record: PayrollRecord) -> dict:
    return {
        "id": str(record.id),
        "employee_id": str(record.employee_id),
        "period_start": record.period_start.isoformat(),
        "period_end": record.period_end.isoformat(),
        "gross_salary": str(record.gross_salary),
        "net_salary": str(record.net_salary),
        "currency": record.currency,
    }
```

### Step 3 - Update Tool Definition

In `backend/app/agent/tools/definitions.py`, update `get_payroll_summary`:

```python
{
    "name": "get_payroll_summary",
    "description": "Return payroll records for the current user's own employee profile.",
    "input_schema": {
        "type": "object",
        "properties": {
            "period": {
                "type": "string",
                "description": "Optional period label, such as May 2026",
            },
        },
    },
}
```

Remove:

- `employee_id` property,
- `required: ["employee_id"]`.

This change matters because the tool schema should not encourage the model to supply sensitive identity.

## Files To Touch

Expected files:

- `backend/app/services/payroll_service.py`
- `backend/app/agent/tools/payroll_tools.py`
- `backend/app/agent/tools/definitions.py`
- `backend/tests/agent/test_payroll_tools.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- payroll API routes,
- frontend payroll page,
- admin payroll behavior,
- manager payroll behavior,
- payroll write behavior.

## Acceptance Criteria

This story is done when:

- `get_payroll_summary` returns only the current employee's payroll records.
- model-supplied `employee_id` cannot change whose payroll is returned.
- unlinked users receive `profile_not_linked`.
- employees with no payroll records receive `payroll_records: []`.
- payroll values are serialized safely.
- payroll tool definition no longer requires or advertises `employee_id`.
- tests cover allowed and blocked cross-employee access.
- full backend tests pass.
- Ruff passes.
- `docs/PROJECT_PLAN.md` marks `E5-S4` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

Expected final result:

```text
pytest: all tests pass
ruff: All checks passed
```

## Commit Message

```text
E5-S4: enforce self-only payroll agent access
```

## Next Story After This

Recommended next story:

**E5-S6 - As a user, unsupported tool requests return a clear not-implemented or not-authorized response.**

This tightens the agent error contract before we add broader admin or notification behavior.
