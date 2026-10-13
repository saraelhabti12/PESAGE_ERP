from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.permission_model import Permission
from app.models.role_model import Role
from app.schemas.role_schemas import RoleCreate, RoleResponse, RoleUpdate
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


@router.post(
    "",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("roles.create"))],
)
def create_role(data: RoleCreate, db: Session = Depends(get_db)):
    """Creates a new role with assigned permissions."""
    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce rôle existe déjà.")
    role = Role(name=data.name, description=data.description)
    if data.permission_ids:
        perms = db.query(Permission).filter(Permission.id.in_(data.permission_ids)).all()
        role.permissions = perms
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get(
    "/{role_id}",
    response_model=RoleResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("roles.view"))],
)
def get_role(role_id: int, db: Session = Depends(get_db)):
    """Retrieves a single role by ID."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rôle non trouvé.")
    return role


@router.put(
    "/{role_id}",
    response_model=RoleResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("roles.update"))],
)
def update_role(role_id: int, data: RoleUpdate, db: Session = Depends(get_db)):
    """Updates role description and assigned permissions."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rôle non trouvé.")
    if data.name is not None and data.name != role.name:
        existing = db.query(Role).filter(Role.name == data.name, Role.id != role_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce nom de rôle est déjà utilisé.")
        role.name = data.name
    if data.description is not None:
        role.description = data.description
    if data.permission_ids is not None:
        perms = db.query(Permission).filter(Permission.id.in_(data.permission_ids)).all()
        role.permissions = perms
    db.commit()
    db.refresh(role)
    return role
