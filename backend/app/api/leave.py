from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.leave import LeaveRequestCreate, LeaveRequestResponse
from app.services.employee_service import get_employee_for_user
from app.services.leave_service import (
    InvalidLeaveRequestError,
    LeaveAuthorizationError,
    LeaveRequestNotFoundError,
    approve_leave_request,
    list_leave_requests_for_employee,
    list_pending_leave_requests_for_manager,
    submit_leave_request,
)

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


@router.post("/mine", response_model=LeaveRequestResponse, status_code=201)
def submit_my_leave_request(
    payload: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    try:
        request = submit_leave_request(db, employee, payload)
    except InvalidLeaveRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _serialize_leave_request(request)


@router.get("/team/pending", response_model=list[LeaveRequestResponse])
def get_team_pending_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    manager = get_employee_for_user(db, current_user)
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return [
        _serialize_leave_request(request)
        for request in list_pending_leave_requests_for_manager(db, manager)
    ]


@router.post("/{request_id}/approve", response_model=LeaveRequestResponse)
def approve_team_leave_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    manager = get_employee_for_user(db, current_user)
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    try:
        request = approve_leave_request(db, manager, request_id)
    except LeaveRequestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except LeaveAuthorizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except InvalidLeaveRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _serialize_leave_request(request)
