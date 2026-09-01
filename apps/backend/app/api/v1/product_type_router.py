from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.product_type_schemas import ProductTypeCreate, ProductTypeResponse, ProductTypeUpdate
from app.security.deps import require_permission
from app.services.catalog_services import CatalogService

router = APIRouter(prefix="/product-types", tags=["product-types"])


@router.get("", response_model=List[ProductTypeResponse])
def get_product_types(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_types.view")),
):
    items, _ = CatalogService.get_product_types(db, page=page, size=size, search=search, is_active=is_active)
    return items


@router.get("/{type_id}", response_model=ProductTypeResponse)
def get_product_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_types.view")),
):
    return CatalogService.get_product_type_by_id(db, type_id)


@router.post("", response_model=ProductTypeResponse, status_code=status.HTTP_201_CREATED)
def create_product_type(
    data: ProductTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_types.create")),
):
    return CatalogService.create_product_type(db, data)


@router.put("/{type_id}", response_model=ProductTypeResponse)
def update_product_type(
    type_id: int,
    data: ProductTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_types.update")),
):
    return CatalogService.update_product_type(db, type_id, data)


@router.delete("/{type_id}", response_model=ProductTypeResponse)
def delete_product_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_types.delete")),
):
    return CatalogService.delete_product_type(db, type_id)
