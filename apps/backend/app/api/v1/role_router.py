from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.role_model import Role
from app.schemas.role_schemas import RoleResponse
from app.security.deps import require_permission

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get(
    "",
    response_model=List[RoleResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("roles.view"))],
)
def list_roles(db: Session = Depends(get_db)):
    """Lists all roles (requires roles.view permission)."""
    return db.query(Role).all()
