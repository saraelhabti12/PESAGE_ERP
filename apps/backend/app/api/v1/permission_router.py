from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.permission_model import Permission
from app.schemas.permission_schemas import PermissionResponse
from app.security.deps import get_current_user

router = APIRouter(prefix="/permissions", tags=["Permissions"])


@router.get(
    "",
    response_model=List[PermissionResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(get_current_user)],
)
def list_permissions(db: Session = Depends(get_db)):
    """Lists all permissions (requires authenticated user)."""
    return db.query(Permission).all()
