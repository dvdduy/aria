from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest


class DuplicateEmailError(ValueError):
    pass


def register_user(db: Session, payload: RegisterRequest):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise DuplicateEmailError("Email is already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"access_token": token, "token_type": "bearer"}


def login_user(db: Session, payload: LoginRequest):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        return None
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"access_token": token, "token_type": "bearer"}
