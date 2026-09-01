from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.brand_schemas import BrandCreate, BrandResponse, BrandUpdate
from app.security.deps import require_permission
from app.services.catalog_services import CatalogService

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=List[BrandResponse])
def get_brands(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("brands.view")),
):
    items, _ = CatalogService.get_brands(db, page=page, size=size, search=search, is_active=is_active)
    return items


@router.get("/{brand_id}", response_model=BrandResponse)
def get_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("brands.view")),
):
    return CatalogService.get_brand_by_id(db, brand_id)


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
def create_brand(
    data: BrandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("brands.create")),
):
    return CatalogService.create_brand(db, data)


@router.put("/{brand_id}", response_model=BrandResponse)
def update_brand(
    brand_id: int,
    data: BrandUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("brands.update")),
):
    return CatalogService.update_brand(db, brand_id, data)


@router.delete("/{brand_id}", response_model=BrandResponse)
def delete_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("brands.delete")),
):
    return CatalogService.delete_brand(db, brand_id)
