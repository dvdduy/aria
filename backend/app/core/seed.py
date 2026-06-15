from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password


def seed_dev_data(db: Session):
    if db.query(User).filter(User.email == "admin@aria.dev").first():
        print("Dev users already exist, skipping seed")
        return

    users = [
        User(email="admin@aria.dev",    hashed_password=hash_password("admin123"),    is_admin=True,  is_active=True),
        User(email="manager@aria.dev",  hashed_password=hash_password("manager123"),  is_admin=False, is_active=True),
        User(email="employee@aria.dev", hashed_password=hash_password("employee123"), is_admin=False, is_active=True),
    ]
    db.add_all(users)
    db.commit()
    print("Dev seed users created")
