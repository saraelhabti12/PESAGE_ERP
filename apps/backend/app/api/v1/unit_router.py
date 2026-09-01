from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.unit_schemas import UnitCreate, UnitResponse, UnitUpdate
from app.security.deps import require_permission
from app.services.catalog_services import CatalogService

router = APIRouter(prefix="/units", tags=["units"])


@router.get("", response_model=List[UnitResponse])
def get_units(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units.view")),
):
    items, _ = CatalogService.get_units(db, page=page, size=size, search=search, is_active=is_active)
    return items


@router.get("/{unit_id}", response_model=UnitResponse)
def get_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units.view")),
):
    return CatalogService.get_unit_by_id(db, unit_id)


@router.post("", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
def create_unit(
    data: UnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units.create")),
):
    return CatalogService.create_unit(db, data)


@router.put("/{unit_id}", response_model=UnitResponse)
def update_unit(
    unit_id: int,
    data: UnitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units.update")),
):
    return CatalogService.update_unit(db, unit_id, data)


@router.delete("/{unit_id}", response_model=UnitResponse)
def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("units.delete")),
):
    return CatalogService.delete_unit(db, unit_id)
