import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.role_model import Role
from app.models.session_model import UserSession
from app.models.user_model import User
from app.schemas.auth_schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user_schemas import UserProfileUpdate, UserResponse
from app.security.deps import get_current_user
from app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.security.passwords import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    """Registers a new user account with default USER role."""
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered",
        )

    # Fetch default USER role
    user_role = db.query(Role).filter(Role.name == "USER").first()

    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    if user_role:
        new_user.roles.append(user_role)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticates user credentials and issues JWT access token & revocable refresh token session."""
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    # Create refresh token & database session record
    refresh_token_str = create_refresh_token(data={"sub": str(user.id), "session_id": str(uuid.uuid4())})
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    user_agent = request.headers.get("User-Agent")
    client_ip = request.client.host if request.client else None

    session_record = UserSession(
        user_id=user.id,
        refresh_token=refresh_token_str,
        user_agent=user_agent,
        ip_address=client_ip,
        expires_at=expires_at,
        created_at=datetime.now(timezone.utc),
    )
    db.add(session_record)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer",
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def refresh(
    data: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Validates refresh session, revokes old refresh token, and issues new token pair (Token Rotation)."""
    try:
        payload = decode_token(data.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    session_record = (
        db.query(UserSession)
        .filter(UserSession.refresh_token == data.refresh_token)
        .first()
    )

    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not found or revoked",
        )

    if session_record.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    current_time = datetime.now(timezone.utc)
    if session_record.expires_at <= current_time:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session has expired",
        )

    user = db.query(User).filter(User.id == session_record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive or no longer exists",
        )

    # Revoke old session (Rotation)
    session_record.revoked_at = current_time

    # Create new access token and refresh token
    new_access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    new_refresh_token_str = create_refresh_token(data={"sub": str(user.id), "session_id": str(uuid.uuid4())})
    new_expires_at = current_time + timedelta(days=7)

    user_agent = request.headers.get("User-Agent")
    client_ip = request.client.host if request.client else None

    new_session_record = UserSession(
        user_id=user.id,
        refresh_token=new_refresh_token_str,
        user_agent=user_agent,
        ip_address=client_ip,
        expires_at=new_expires_at,
        created_at=current_time,
    )
    db.add(new_session_record)
    db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token_str,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Returns profile details of the authenticated user."""
    return current_user


@router.put(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def update_me(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates profile details for the authenticated user."""
    # Check email uniqueness if email is changing
    if data.email and data.email != current_user.email:
        existing = db.query(User).filter(User.email == data.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cette adresse email est déjà utilisée par un autre compte.",
            )
        current_user.email = data.email

    if data.first_name is not None:
        current_user.first_name = data.first_name
    if data.last_name is not None:
        current_user.last_name = data.last_name
    if data.phone is not None:
        current_user.phone = data.phone

    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Changes the password of the current authenticated user."""
    # 1. Verify current password
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe actuel est incorrect.",
        )

    # 2. Check confirmation
    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe et sa confirmation ne correspondent pas.",
        )

    # 3. Check password strength (minimum 8 characters)
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit comporter au moins 8 caractères.",
        )

    # 4. Hash and update
    current_user.password_hash = hash_password(data.new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "ok", "message": "Mot de passe modifié avec succès."}


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
)
def logout(
    data: LogoutRequest,
    db: Session = Depends(get_db),
):
    """Revokes the refresh token session in the database."""
    session_record = (
        db.query(UserSession)
        .filter(UserSession.refresh_token == data.refresh_token)
        .first()
    )

    if session_record and session_record.revoked_at is None:
        session_record.revoked_at = datetime.now(timezone.utc)
        db.commit()

    return {"status": "ok", "message": "Successfully logged out and session revoked"}

