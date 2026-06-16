from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.leave import LeaveRequestResponse
from app.services.employee_service import get_employee_for_user
from app.services.leave_service import list_leave_requests_for_employee

router = APIRouter()


def _serialize_leave_request(request):
    return {
        "id": str(request.id),
        "employee_id": str(request.employee_id),
        "leave_type": request.leave_type,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "days_requested": request.days_requested,
        "status": request.status,
        "reason": request.reason,
        "approved_by": str(request.approved_by) if request.approved_by else None,
        "approved_at": request.approved_at,
    }


@router.get("/mine", response_model=list[LeaveRequestResponse])
def get_my_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return [
        _serialize_leave_request(request)
        for request in list_leave_requests_for_employee(db, employee)
    ]
