from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.partner_schemas import (
    PartnerAddressCreate,
    PartnerAddressResponse,
    PartnerAddressUpdate,
    PartnerContactCreate,
    PartnerContactResponse,
    PartnerContactUpdate,
    PartnerCreate,
    PartnerDetailResponse,
    PartnerResponse,
    PartnerTypeEnum,
    PartnerUpdate,
)
from app.security.deps import require_permission
from app.services.partner_services import PartnerService

router = APIRouter(tags=["Partners, Customers & Suppliers"])


# ----------------------------------------------------
# BUSINESS PARTNERS
# ----------------------------------------------------
@router.get(
    "/partners",
    response_model=List[PartnerResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("partners.view"))],
)
def get_partners(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    type: Optional[PartnerTypeEnum] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists business partners with optional search, type, and status filtering."""
    items, _ = PartnerService.get_partners(
        db, page=page, size=size, search=search, is_active=is_active, partner_type=type
    )
    return items


@router.get(
    "/partners/{partner_id}",
    response_model=PartnerDetailResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("partners.view"))],
)
def get_partner(
    partner_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves detailed partner profile with contacts and addresses."""
    return PartnerService.get_partner_by_id(db, partner_id)


@router.post(
    "/partners",
    response_model=PartnerResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("partners.create"))],
)
def create_partner(
    data: PartnerCreate,
    db: Session = Depends(get_db),
):
    """Creates a new business partner."""
    return PartnerService.create_partner(db, data)


@router.put(
    "/partners/{partner_id}",
    response_model=PartnerResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("partners.update"))],
)
def update_partner(
    partner_id: int,
    data: PartnerUpdate,
    db: Session = Depends(get_db),
):
    """Updates a business partner."""
    return PartnerService.update_partner(db, partner_id, data)


@router.delete(
    "/partners/{partner_id}",
    response_model=PartnerResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("partners.delete"))],
)
def delete_partner(
    partner_id: int,
    db: Session = Depends(get_db),
):
    """Soft-deactivates a business partner."""
    return PartnerService.delete_partner(db, partner_id)


# ----------------------------------------------------
# CUSTOMERS (FILTERED PARTNER ENDPOINTS)
# ----------------------------------------------------
@router.get(
    "/customers",
    response_model=List[PartnerResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("customers.view"))],
)
def get_customers(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists customers (partner_type is CUSTOMER or CUSTOMER_SUPPLIER)."""
    items, _ = PartnerService.get_partners(
        db, page=page, size=size, search=search, is_active=is_active, only_customers=True
    )
    return items


@router.get(
    "/customers/{partner_id}",
    response_model=PartnerDetailResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("customers.view"))],
)
def get_customer(
    partner_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves customer detail."""
    partner = PartnerService.get_partner_by_id(db, partner_id)
    if partner.partner_type not in (PartnerTypeEnum.CUSTOMER.value, PartnerTypeEnum.CUSTOMER_SUPPLIER.value):
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client non trouvé.")
    return partner


# ----------------------------------------------------
# SUPPLIERS (FILTERED PARTNER ENDPOINTS)
# ----------------------------------------------------
@router.get(
    "/suppliers",
    response_model=List[PartnerResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("suppliers.view"))],
)
def get_suppliers(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists suppliers (partner_type is SUPPLIER or CUSTOMER_SUPPLIER)."""
    items, _ = PartnerService.get_partners(
        db, page=page, size=size, search=search, is_active=is_active, only_suppliers=True
    )
    return items


@router.get(
    "/suppliers/{partner_id}",
    response_model=PartnerDetailResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("suppliers.view"))],
)
def get_supplier(
    partner_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves supplier detail."""
    partner = PartnerService.get_partner_by_id(db, partner_id)
    if partner.partner_type not in (PartnerTypeEnum.SUPPLIER.value, PartnerTypeEnum.CUSTOMER_SUPPLIER.value):
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur non trouvé.")
    return partner


# ----------------------------------------------------
# PARTNER CONTACTS
# ----------------------------------------------------
@router.get(
    "/partners/{partner_id}/contacts",
    response_model=List[PartnerContactResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("contacts.view"))],
)
def get_partner_contacts(
    partner_id: int,
    db: Session = Depends(get_db),
):
    """Lists contacts for a specific partner."""
    return PartnerService.get_contacts(db, partner_id)


@router.post(
    "/partners/{partner_id}/contacts",
    response_model=PartnerContactResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("contacts.create"))],
)
def create_partner_contact(
    partner_id: int,
    data: PartnerContactCreate,
    db: Session = Depends(get_db),
):
    """Creates a contact for a partner."""
    return PartnerService.create_contact(db, partner_id, data)


@router.put(
    "/partners/{partner_id}/contacts/{contact_id}",
    response_model=PartnerContactResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("contacts.update"))],
)
def update_partner_contact(
    partner_id: int,
    contact_id: int,
    data: PartnerContactUpdate,
    db: Session = Depends(get_db),
):
    """Updates a partner contact."""
    return PartnerService.update_contact(db, partner_id, contact_id, data)


@router.delete(
    "/partners/{partner_id}/contacts/{contact_id}",
    response_model=PartnerContactResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("contacts.delete"))],
)
def delete_partner_contact(
    partner_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
):
    """Deletes a partner contact."""
    return PartnerService.delete_contact(db, partner_id, contact_id)


# ----------------------------------------------------
# PARTNER ADDRESSES
# ----------------------------------------------------
@router.get(
    "/partners/{partner_id}/addresses",
    response_model=List[PartnerAddressResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("addresses.view"))],
)
def get_partner_addresses(
    partner_id: int,
    db: Session = Depends(get_db),
):
    """Lists addresses for a specific partner."""
    return PartnerService.get_addresses(db, partner_id)


@router.post(
    "/partners/{partner_id}/addresses",
    response_model=PartnerAddressResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("addresses.create"))],
)
def create_partner_address(
    partner_id: int,
    data: PartnerAddressCreate,
    db: Session = Depends(get_db),
):
    """Creates an address for a partner."""
    return PartnerService.create_address(db, partner_id, data)


@router.put(
    "/partners/{partner_id}/addresses/{address_id}",
    response_model=PartnerAddressResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("addresses.update"))],
)
def update_partner_address(
    partner_id: int,
    address_id: int,
    data: PartnerAddressUpdate,
    db: Session = Depends(get_db),
):
    """Updates a partner address."""
    return PartnerService.update_address(db, partner_id, address_id, data)


@router.delete(
    "/partners/{partner_id}/addresses/{address_id}",
    response_model=PartnerAddressResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("addresses.delete"))],
)
def delete_partner_address(
    partner_id: int,
    address_id: int,
    db: Session = Depends(get_db),
):
    """Deletes a partner address."""
    return PartnerService.delete_address(db, partner_id, address_id)
