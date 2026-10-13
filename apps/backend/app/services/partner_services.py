from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.attachment_model import Attachment
from app.models.credit_note_model import CreditNote, CreditNoteStatus
from app.models.delivery_note_model import DeliveryNote
from app.models.invoice_model import Invoice, InvoiceStatus, InvoiceType
from app.models.maintenance_model import Equipment, Intervention
from app.models.partner_model import AddressType, BusinessPartner, PartnerAddress, PartnerContact, PartnerType
from app.models.payment_model import Payment
from app.models.purchase_model import PurchaseOrder, PurchaseOrderStatus, PurchaseReceipt
from app.models.quote_model import Quote
from app.models.sale_model import Sale, SaleStatus
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

        p_type_val = (partner_type.value if hasattr(partner_type, "value") else str(partner_type)).upper() if partner_type else None
        is_customer = only_customers or p_type_val == "CUSTOMER"
        is_supplier = only_suppliers or p_type_val == "SUPPLIER"

        if is_customer:
            query = query.filter(
                BusinessPartner.partner_type.in_([PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER])
            )
        elif is_supplier:
            query = query.filter(
                BusinessPartner.partner_type.in_([PartnerType.SUPPLIER, PartnerType.CUSTOMER_SUPPLIER])
            )
        elif p_type_val:
            query = query.filter(BusinessPartner.partner_type == p_type_val)

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
    def generate_partner_code(db: Session, partner_type: PartnerTypeEnum | str) -> str:
        """Generates sequential code CLI-YYYY-XXXX (customer) or FOU-YYYY-XXXX (supplier)."""
        from sqlalchemy import func
        now = datetime.now(timezone.utc)
        p_type_val = partner_type.value if hasattr(partner_type, "value") else str(partner_type)
        prefix = "FOU" if p_type_val == "SUPPLIER" else "CLI"
        full_prefix = f"{prefix}-{now.strftime('%Y')}-"
        count = db.query(func.count(BusinessPartner.id)).filter(BusinessPartner.code.like(f"{full_prefix}%")).scalar() or 0
        return f"{full_prefix}{count + 1:04d}"

    @staticmethod
    def create_partner(db: Session, data: PartnerCreate) -> BusinessPartner:
        """Creates a new business partner ensuring unique code, generating automatically if not provided."""
        from sqlalchemy import func
        code = data.code.strip() if data.code and data.code.strip() and data.code.strip().upper() != "AUTO" else PartnerService.generate_partner_code(db, data.partner_type)
        existing = db.query(BusinessPartner).filter(BusinessPartner.code == code).first()
        if existing:
            if not data.code or data.code.strip().upper() == "AUTO":
                count = db.query(func.count(BusinessPartner.id)).scalar() or 0
                code = f"{code}-{count + 1}"
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Le code partenaire '{code}' est déjà utilisé.",
                )

        partner = BusinessPartner(
            code=code,
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

    @staticmethod
    def get_partner_summary(db: Session, partner_id: int) -> dict:
        """Returns comprehensive real-time aggregated metrics for a customer or supplier."""
        partner = db.query(BusinessPartner).filter(BusinessPartner.id == partner_id).first()
        if not partner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partenaire introuvable.")

        p_type = partner.partner_type.value if hasattr(partner.partner_type, "value") else str(partner.partner_type)

        # Quotes
        quotes_q = db.query(
            func.count(Quote.id),
            func.coalesce(func.sum(Quote.total_ttc), 0.0),
            func.max(Quote.quote_date),
        ).filter(Quote.customer_id == partner_id).first()
        total_quotes = quotes_q[0] if quotes_q else 0
        last_quote_date = quotes_q[2] if quotes_q else None

        # Sales
        sales_q = db.query(
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total_ttc), 0.0),
            func.max(Sale.order_date),
        ).filter(Sale.customer_id == partner_id, Sale.status != SaleStatus.CANCELLED).first()
        total_sales = sales_q[0] if sales_q else 0
        total_sales_ttc = round(float(sales_q[1]), 2) if sales_q else 0.0
        last_sale_date = sales_q[2] if sales_q else None

        # Delivery Notes
        total_bl = db.query(func.count(DeliveryNote.id)).filter(DeliveryNote.customer_id == partner_id).scalar() or 0

        # Customer Invoices
        c_inv_q = db.query(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_ttc), 0.0),
            func.coalesce(func.sum(Invoice.amount_paid), 0.0),
            func.coalesce(func.sum(Invoice.amount_due), 0.0),
            func.max(Invoice.invoice_date),
        ).filter(
            Invoice.customer_id == partner_id,
            Invoice.invoice_type == InvoiceType.CUSTOMER,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).first()
        total_invoices = c_inv_q[0] if c_inv_q else 0
        total_invoiced_ttc = round(float(c_inv_q[1]), 2) if c_inv_q else 0.0
        amount_paid = round(float(c_inv_q[2]), 2) if c_inv_q else 0.0
        amount_due = round(float(c_inv_q[3]), 2) if c_inv_q else 0.0
        last_inv_date = c_inv_q[4] if c_inv_q else None

        # Credit Notes
        cn_q = db.query(
            func.count(CreditNote.id),
            func.coalesce(func.sum(CreditNote.total_ttc), 0.0),
        ).filter(CreditNote.customer_id == partner_id, CreditNote.status != CreditNoteStatus.CANCELLED).first()
        total_cn = cn_q[0] if cn_q else 0
        total_cn_amount = round(float(cn_q[1]), 2) if cn_q else 0.0

        # Interventions & Equipments
        total_interventions = db.query(func.count(Intervention.id)).filter(Intervention.customer_id == partner_id).scalar() or 0
        total_equipments = db.query(func.count(Equipment.id)).filter(Equipment.customer_id == partner_id).scalar() or 0

        # Supplier Purchases
        purch_q = db.query(
            func.count(PurchaseOrder.id),
            func.coalesce(func.sum(PurchaseOrder.total_ttc), 0.0),
            func.max(PurchaseOrder.order_date),
        ).filter(PurchaseOrder.supplier_id == partner_id, PurchaseOrder.status != PurchaseOrderStatus.CANCELLED).first()
        total_purchases = purch_q[0] if purch_q else 0
        total_purchases_ttc = round(float(purch_q[1]), 2) if purch_q else 0.0
        last_purch_date = purch_q[2] if purch_q else None

        # Supplier Invoices
        s_inv_q = db.query(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_ttc), 0.0),
            func.coalesce(func.sum(Invoice.amount_paid), 0.0),
            func.coalesce(func.sum(Invoice.amount_due), 0.0),
            func.max(Invoice.invoice_date),
        ).filter(
            Invoice.supplier_id == partner_id,
            Invoice.invoice_type == InvoiceType.SUPPLIER,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).first()
        total_s_invoices = s_inv_q[0] if s_inv_q else 0
        total_s_invoiced_ttc = round(float(s_inv_q[1]), 2) if s_inv_q else 0.0
        s_amount_paid = round(float(s_inv_q[2]), 2) if s_inv_q else 0.0
        s_amount_due = round(float(s_inv_q[3]), 2) if s_inv_q else 0.0
        last_s_inv_date = s_inv_q[4] if s_inv_q else None

        # Purchase Receipts
        total_receipts = (
            db.query(func.count(PurchaseReceipt.id))
            .join(PurchaseReceipt.purchase_order)
            .filter(PurchaseOrder.supplier_id == partner_id)
            .scalar()
            or 0
        )

        # Payments
        total_payments = db.query(func.count(Payment.id)).filter(Payment.customer_id == partner_id).scalar() or 0

        # Documents / Attachments
        total_docs = db.query(func.count(Attachment.id)).filter(
            Attachment.entity_id == partner_id,
            Attachment.entity_type.in_(["CUSTOMER", "SUPPLIER", "PARTNER"]),
        ).scalar() or 0

        # Find last transaction date
        dates = [d for d in [last_quote_date, last_sale_date, last_inv_date, last_purch_date, last_s_inv_date] if d]
        last_tx_date = max(dates) if dates else None

        return {
            "partner_id": partner.id,
            "partner_type": p_type,
            "total_quotes": total_quotes,
            "total_sales": total_sales,
            "total_sales_ttc": total_sales_ttc,
            "total_invoices": total_invoices,
            "total_invoiced_ttc": total_invoiced_ttc,
            "amount_paid": amount_paid,
            "amount_due": amount_due,
            "total_delivery_notes": total_bl,
            "total_credit_notes": total_cn,
            "total_credit_notes_amount": total_cn_amount,
            "total_interventions": total_interventions,
            "total_equipments": total_equipments,
            "total_purchases": total_purchases,
            "total_purchases_ttc": total_purchases_ttc,
            "total_supplier_invoices": total_s_invoices,
            "total_supplier_invoiced_ttc": total_s_invoiced_ttc,
            "supplier_amount_paid": s_amount_paid,
            "supplier_amount_due": s_amount_due,
            "total_receipts": total_receipts,
            "total_payments": total_payments,
            "total_documents": total_docs,
            "last_transaction_date": last_tx_date,
        }

