from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.notification_service import list_notifications_for_user, mark_all_read

router = APIRouter()


def _serialize(notif) -> dict:
    return {
        "id": str(notif.id),
        "message": notif.message,
        "is_read": notif.is_read,
        "created_at": notif.created_at.isoformat(),
    }


@router.get("")
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = list_notifications_for_user(db, current_user)
    unread = sum(1 for n in notifications if not n.is_read)
    return {
        "notifications": [_serialize(n) for n in notifications],
        "unread_count": unread,
    }


@router.post("/read-all")
def mark_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = mark_all_read(db, current_user)
    return {"marked_read": count}
