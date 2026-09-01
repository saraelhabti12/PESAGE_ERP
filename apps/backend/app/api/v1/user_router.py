from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.user_schemas import UserCreate, UserResponse, UserUpdate
from app.security.deps import require_permission
from app.security.passwords import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=List[UserResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.view"))],
)
def list_users(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists all users with optional search and active status filters (requires users.view permission)."""
    query = db.query(User)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_pattern))
            | (User.last_name.ilike(search_pattern))
            | (User.email.ilike(search_pattern))
        )
    return query.order_by(User.id.asc()).all()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.view"))],
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves user profile by ID (requires users.view permission)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé.",
        )
    return user


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("users.create"))],
)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
):
    """Creates a new user account with hashed password and assigned roles (requires users.create permission)."""
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette adresse e-mail est déjà utilisée.",
        )

    try:
        new_user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        if data.role_ids:
            roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
            new_user.roles = roles
        else:
            default_role = db.query(Role).filter(Role.name == "USER").first()
            if default_role:
                new_user.roles.append(default_role)

        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        db.rollback()
        raise e


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.update"))],
)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
):
    """Updates an existing user account (requires users.update permission)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé.",
        )

    if data.email and data.email != user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cette adresse e-mail est déjà utilisée.",
            )
        user.email = data.email

    try:
        if data.first_name is not None:
            user.first_name = data.first_name
        if data.last_name is not None:
            user.last_name = data.last_name
        if data.phone is not None:
            user.phone = data.phone
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.password:
            user.password_hash = hash_password(data.password)
        if data.role_ids is not None:
            roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
            user.roles = roles

        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user
    except Exception as e:
        db.rollback()
        raise e


@router.delete(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.delete"))],
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Deactivates a user account (requires users.delete permission)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé.",
        )

    try:
        user.is_active = False
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user
    except Exception as e:
        db.rollback()
        raise e
