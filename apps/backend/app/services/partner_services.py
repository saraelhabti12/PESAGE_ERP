from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.partner_model import AddressType, BusinessPartner, PartnerAddress, PartnerContact, PartnerType
from app.schemas.partner_schemas import (
    PartnerAddressCreate,
    PartnerAddressUpdate,
    PartnerContactCreate,
    PartnerContactUpdate,
    PartnerCreate,
    PartnerTypeEnum,
    PartnerUpdate,
)


class PartnerService:
    # ----------------------------------------------------
    # BUSINESS PARTNERS (CUSTOMERS & SUPPLIERS)
    # ----------------------------------------------------
    @staticmethod
    def get_partners(
        db: Session,
        page: int = 1,
        size: int = 50,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        partner_type: Optional[PartnerTypeEnum] = None,
        only_customers: bool = False,
        only_suppliers: bool = False,
    ) -> Tuple[List[BusinessPartner], int]:
        """Lists partners with optional search, type filtering, and pagination."""
        query = db.query(BusinessPartner)

        if is_active is not None:
            query = query.filter(BusinessPartner.is_active == is_active)

        if only_customers:
            query = query.filter(
                BusinessPartner.partner_type.in_([PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER])
            )
        elif only_suppliers:
            query = query.filter(
                BusinessPartner.partner_type.in_([PartnerType.SUPPLIER, PartnerType.CUSTOMER_SUPPLIER])
            )
        elif partner_type:
            query = query.filter(BusinessPartner.partner_type == partner_type.value)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    BusinessPartner.code.ilike(s),
                    BusinessPartner.legal_name.ilike(s),
                    BusinessPartner.trade_name.ilike(s),
                    BusinessPartner.ice.ilike(s),
                    BusinessPartner.phone.ilike(s),
                    BusinessPartner.email.ilike(s),
                    BusinessPartner.city.ilike(s),
                )
            )

        total = query.count()
        items = query.order_by(BusinessPartner.legal_name.asc()).offset((page - 1) * size).limit(size).all()
        return items, total

    @staticmethod
    def get_partner_by_id(db: Session, partner_id: int) -> BusinessPartner:
        """Retrieves partner by ID including contacts and addresses."""
        partner = (
            db.query(BusinessPartner)
            .options(
                joinedload(BusinessPartner.contacts),
                joinedload(BusinessPartner.addresses),
            )
            .filter(BusinessPartner.id == partner_id)
            .first()
        )
        if not partner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partenaire commercial non trouvé.",
            )
        return partner

    @staticmethod
    def create_partner(db: Session, data: PartnerCreate) -> BusinessPartner:
        """Creates a new business partner ensuring unique code."""
        existing = db.query(BusinessPartner).filter(BusinessPartner.code == data.code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Le code partenaire '{data.code}' est déjà utilisé.",
            )

        partner = BusinessPartner(
            code=data.code,
            legal_name=data.legal_name,
            trade_name=data.trade_name,
            partner_type=data.partner_type.value,
            ice=data.ice,
            tax_id=data.tax_id,
            registration_number=data.registration_number,
            phone=data.phone,
            email=data.email,
            website=data.website,
            address=data.address,
            city=data.city,
            country=data.country or "Maroc",
            postal_code=data.postal_code,
            notes=data.notes,
            is_active=data.is_active,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(partner)
        db.commit()
        db.refresh(partner)
        return partner

    @staticmethod
    def update_partner(db: Session, partner_id: int, data: PartnerUpdate) -> BusinessPartner:
        """Updates partner fields with uniqueness verification."""
        partner = PartnerService.get_partner_by_id(db, partner_id)
        update_dict = data.model_dump(exclude_unset=True)

        if "code" in update_dict and update_dict["code"] != partner.code:
            existing = db.query(BusinessPartner).filter(BusinessPartner.code == update_dict["code"]).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Le code partenaire '{update_dict['code']}' est déjà utilisé.",
                )

        if "partner_type" in update_dict and update_dict["partner_type"] is not None:
            update_dict["partner_type"] = update_dict["partner_type"].value

        for field, val in update_dict.items():
            setattr(partner, field, val)

        partner.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(partner)
        return partner

    @staticmethod
    def delete_partner(db: Session, partner_id: int) -> BusinessPartner:
        """Soft-deactivates a business partner."""
        partner = PartnerService.get_partner_by_id(db, partner_id)
        partner.is_active = False
        partner.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(partner)
        return partner

    # ----------------------------------------------------
    # PARTNER CONTACTS
    # ----------------------------------------------------
    @staticmethod
    def get_contacts(db: Session, partner_id: int) -> List[PartnerContact]:
        """Lists contacts for a given partner."""
        # Ensure partner exists
        PartnerService.get_partner_by_id(db, partner_id)
        return (
            db.query(PartnerContact)
            .filter(PartnerContact.partner_id == partner_id)
            .order_by(PartnerContact.is_primary.desc(), PartnerContact.id.asc())
            .all()
        )

    @staticmethod
    def get_contact_by_id(db: Session, partner_id: int, contact_id: int) -> PartnerContact:
        """Retrieves a specific contact verifying partner ownership."""
        contact = (
            db.query(PartnerContact)
            .filter(PartnerContact.id == contact_id, PartnerContact.partner_id == partner_id)
            .first()
        )
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact non trouvé pour ce partenaire.",
            )
        return contact

    @staticmethod
    def create_contact(db: Session, partner_id: int, data: PartnerContactCreate) -> PartnerContact:
        """Creates a contact for a partner, ensuring only one primary contact exists."""
        PartnerService.get_partner_by_id(db, partner_id)

        # Check existing contacts count
        existing_count = db.query(PartnerContact).filter(PartnerContact.partner_id == partner_id).count()
        is_primary = data.is_primary or (existing_count == 0)

        if is_primary:
            db.query(PartnerContact).filter(PartnerContact.partner_id == partner_id).update({"is_primary": False})

        contact = PartnerContact(
            partner_id=partner_id,
            first_name=data.first_name,
            last_name=data.last_name,
            position=data.position,
            phone=data.phone,
            email=data.email,
            is_primary=is_primary,
            notes=data.notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact

    @staticmethod
    def update_contact(
        db: Session, partner_id: int, contact_id: int, data: PartnerContactUpdate
    ) -> PartnerContact:
        """Updates a contact, managing primary contact uniqueness."""
        contact = PartnerService.get_contact_by_id(db, partner_id, contact_id)
        update_dict = data.model_dump(exclude_unset=True)

        if update_dict.get("is_primary") is True:
            db.query(PartnerContact).filter(
                PartnerContact.partner_id == partner_id, PartnerContact.id != contact_id
            ).update({"is_primary": False})

        for field, val in update_dict.items():
            setattr(contact, field, val)

        contact.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(contact)
        return contact

    @staticmethod
    def delete_contact(db: Session, partner_id: int, contact_id: int) -> PartnerContact:
        """Deletes a contact."""
        contact = PartnerService.get_contact_by_id(db, partner_id, contact_id)
        db.delete(contact)
        db.commit()
        return contact

    # ----------------------------------------------------
    # PARTNER ADDRESSES
    # ----------------------------------------------------
    @staticmethod
    def get_addresses(db: Session, partner_id: int) -> List[PartnerAddress]:
        """Lists addresses for a given partner."""
        PartnerService.get_partner_by_id(db, partner_id)
        return (
            db.query(PartnerAddress)
            .filter(PartnerAddress.partner_id == partner_id)
            .order_by(PartnerAddress.is_primary.desc(), PartnerAddress.id.asc())
            .all()
        )

    @staticmethod
    def get_address_by_id(db: Session, partner_id: int, address_id: int) -> PartnerAddress:
        """Retrieves an address verifying partner ownership."""
        address = (
            db.query(PartnerAddress)
            .filter(PartnerAddress.id == address_id, PartnerAddress.partner_id == partner_id)
            .first()
        )
        if not address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Adresse non trouvée pour ce partenaire.",
            )
        return address

    @staticmethod
    def create_address(db: Session, partner_id: int, data: PartnerAddressCreate) -> PartnerAddress:
        """Creates an address for a partner, ensuring primary address rule."""
        PartnerService.get_partner_by_id(db, partner_id)

        existing_count = db.query(PartnerAddress).filter(PartnerAddress.partner_id == partner_id).count()
        is_primary = data.is_primary or (existing_count == 0)

        if is_primary:
            db.query(PartnerAddress).filter(PartnerAddress.partner_id == partner_id).update({"is_primary": False})

        address = PartnerAddress(
            partner_id=partner_id,
            type=data.type.value if hasattr(data.type, "value") else data.type,
            label=data.label,
            address_line=data.address_line,
            city=data.city,
            postal_code=data.postal_code,
            country=data.country or "Maroc",
            is_primary=is_primary,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(address)
        db.commit()
        db.refresh(address)
        return address

    @staticmethod
    def update_address(
        db: Session, partner_id: int, address_id: int, data: PartnerAddressUpdate
    ) -> PartnerAddress:
        """Updates an address, managing primary address uniqueness."""
        address = PartnerService.get_address_by_id(db, partner_id, address_id)
        update_dict = data.model_dump(exclude_unset=True)

        if update_dict.get("is_primary") is True:
            db.query(PartnerAddress).filter(
                PartnerAddress.partner_id == partner_id, PartnerAddress.id != address_id
            ).update({"is_primary": False})

        if "type" in update_dict and update_dict["type"] is not None:
            update_dict["type"] = update_dict["type"].value if hasattr(update_dict["type"], "value") else update_dict["type"]

        for field, val in update_dict.items():
            setattr(address, field, val)

        address.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(address)
        return address

    @staticmethod
    def delete_address(db: Session, partner_id: int, address_id: int) -> PartnerAddress:
        """Deletes an address."""
        address = PartnerService.get_address_by_id(db, partner_id, address_id)
        db.delete(address)
        db.commit()
        return address
