from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.credit_note_model import CreditNote, CreditNoteItem, CreditNoteReason, CreditNoteStatus
from app.models.invoice_model import Invoice, InvoiceItem, InvoiceStatus, InvoiceType
from app.models.notification_model import NotificationType
from app.models.partner_model import BusinessPartner
from app.models.product_model import Product
from app.models.stock_model import StockMovementType, Warehouse
from app.schemas.credit_note_schemas import CreditNoteCreate, CreditNoteUpdate
from app.services.invoice_services import InvoiceService
from app.services.notification_services import NotificationService
from app.services.stock_services import StockService


class CreditNoteService:
    @staticmethod
    def generate_reference(db: Session) -> str:
        """Generates sequential reference: AV-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"AV-{now.strftime('%Y%m')}-"
        count = db.query(func.count(CreditNote.id)).filter(CreditNote.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_credit_note(cls, db: Session, data: CreditNoteCreate, user_id: int) -> CreditNote:
        invoice = (
            db.query(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.credit_notes),
            )
            .filter(Invoice.id == data.invoice_id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")

        if invoice.status == InvoiceStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d'émettre un avoir sur une facture annulée.",
            )

        if not invoice.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un avoir client ne peut être créé que sur une facture client.",
            )

        # Calculate already credited totals per invoice_item
        credited_qty_per_item = {}
        total_already_credited = 0.0

        for existing_cn in invoice.credit_notes:
            if existing_cn.status == CreditNoteStatus.ISSUED:
                total_already_credited += float(existing_cn.total_ttc)
                for itm in existing_cn.items:
                    if itm.invoice_item_id:
                        credited_qty_per_item[itm.invoice_item_id] = credited_qty_per_item.get(itm.invoice_item_id, 0.0) + float(itm.quantity)

        reference = cls.generate_reference(db)
        credit_note_date = data.credit_note_date or datetime.now(timezone.utc)

        credit_note = CreditNote(
            reference=reference,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            credit_note_date=credit_note_date,
            reason=data.reason,
            status=CreditNoteStatus.ISSUED,
            notes=data.notes,
            created_by=user_id,
        )

        total_subtotal_ht = 0.0
        total_discount_amount = 0.0
        total_tax_amount = 0.0
        total_ttc = 0.0

        # Process lines
        for item_data in data.items:
            qty = float(item_data.quantity)
            price = float(item_data.unit_price_ht)
            tax_rate = float(item_data.tax_rate)
            discount_rate = float(item_data.discount_rate)

            if qty <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La quantité créditée doit être strictement positive.",
                )

            # Check against invoice item if specified
            if item_data.invoice_item_id:
                inv_item = next((i for i in invoice.items if i.id == item_data.invoice_item_id), None)
                if not inv_item:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La ligne de facture #{item_data.invoice_item_id} n'appartient pas à cette facture.",
                    )
                already_credited = credited_qty_per_item.get(inv_item.id, 0.0)
                max_eligible_qty = float(inv_item.quantity) - already_credited
                if qty > max_eligible_qty + 0.001:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Quantité créditée ({qty}) supérieure à la quantité restante éligible ({max_eligible_qty}) pour '{inv_item.description}'.",
                    )
                credited_qty_per_item[inv_item.id] = already_credited + qty

            line_subtotal, line_discount, line_tax, line_line_ttc = InvoiceService.calculate_line_totals(
                qty, price, tax_rate, discount_rate
            )

            cn_item = CreditNoteItem(
                product_id=item_data.product_id,
                invoice_item_id=item_data.invoice_item_id,
                warehouse_id=item_data.warehouse_id,
                description=item_data.description,
                quantity=qty,
                unit_price_ht=price,
                tax_rate=tax_rate,
                discount_rate=discount_rate,
                line_subtotal_ht=line_subtotal,
                line_discount=line_discount,
                line_tax=line_tax,
                line_total_ttc=line_line_ttc,
                return_to_stock=item_data.return_to_stock,
            )
            credit_note.items.append(cn_item)

            total_subtotal_ht += line_subtotal
            total_discount_amount += line_discount
            total_tax_amount += line_tax
            total_ttc += line_line_ttc

        # Verify total credit note amount does not exceed eligible total
        max_eligible_amount = float(invoice.total_ttc) - total_already_credited
        if total_ttc > max_eligible_amount + 0.10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le montant total de l'avoir ({total_ttc:.2f} DH) dépasse le solde maximum éligible ({max_eligible_amount:.2f} DH) de la facture {invoice.reference}.",
            )

        credit_note.subtotal_ht = round(total_subtotal_ht, 2)
        credit_note.discount_amount = round(total_discount_amount, 2)
        credit_note.tax_amount = round(total_tax_amount, 2)
        credit_note.total_ttc = round(min(total_ttc, max_eligible_amount), 2)

        db.add(credit_note)
        db.flush()

        # Handle physical stock return via StockService
        for itm in credit_note.items:
            if itm.return_to_stock and itm.product_id:
                product = db.query(Product).filter(Product.id == itm.product_id).first()
                if product and product.track_stock:
                    if not itm.warehouse_id:
                        default_wh = db.query(Warehouse).filter(Warehouse.is_active == True).first()
                        if default_wh:
                            itm.warehouse_id = default_wh.id
                        else:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Dépôt de retour obligatoire pour la réintégration en stock de '{itm.description}'.",
                            )
                    wh = db.query(Warehouse).filter(Warehouse.id == itm.warehouse_id, Warehouse.is_active == True).first()
                    if not wh:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Le dépôt de retour spécifié pour '{itm.description}' est invalide ou inactif.",
                        )
                    StockService.add_stock(
                        db=db,
                        product_id=itm.product_id,
                        warehouse_id=itm.warehouse_id,
                        quantity=itm.quantity,
                        movement_type=StockMovementType.RETURN_IN,
                        reference_type="CREDIT_NOTE",
                        reference_id=credit_note.id,
                        reason=f"Avoir {credit_note.reference} - Retour client",
                        user_id=user_id,
                    )

        # Recalculate invoice financials
        InvoiceService.recalculate_invoice_financials(db, invoice)

        db.commit()
        db.refresh(credit_note)

        # Create notification
        NotificationService.create_notification(
            db=db,
            title="Avoir client émis",
            message=f"L'avoir {credit_note.reference} d'un montant de {credit_note.total_ttc:.2f} DH a été émis pour la facture {invoice.reference}.",
            type=NotificationType.INFO,
            user_id=user_id,
            link="/avoirs",
        )

        return credit_note

    @classmethod
    def get_credit_note(cls, db: Session, credit_note_id: int) -> CreditNote:
        cn = (
            db.query(CreditNote)
            .options(
                selectinload(CreditNote.items).selectinload(CreditNoteItem.product),
                selectinload(CreditNote.customer),
                selectinload(CreditNote.invoice),
                selectinload(CreditNote.creator),
            )
            .filter(CreditNote.id == credit_note_id)
            .first()
        )
        if not cn:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avoir introuvable.")
        return cn

    @classmethod
    def cancel_credit_note(cls, db: Session, credit_note_id: int, user_id: int) -> CreditNote:
        cn = cls.get_credit_note(db, credit_note_id)
        if cn.status == CreditNoteStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet avoir est déjà annulé.")

        # If stock was returned, remove it safely
        for itm in cn.items:
            if itm.return_to_stock and itm.product_id and itm.warehouse_id:
                product = db.query(Product).filter(Product.id == itm.product_id).first()
                if product and product.track_stock:
                    StockService.remove_stock(
                        db=db,
                        product_id=itm.product_id,
                        warehouse_id=itm.warehouse_id,
                        quantity=itm.quantity,
                        movement_type=StockMovementType.ADJUSTMENT_OUT,
                        reference_type="CREDIT_NOTE_CANCEL",
                        reference_id=cn.id,
                        reason=f"Annulation Avoir {cn.reference}",
                        user_id=user_id,
                    )

        cn.status = CreditNoteStatus.CANCELLED
        cn.updated_at = datetime.now(timezone.utc)

        # Recalculate invoice
        invoice = db.query(Invoice).filter(Invoice.id == cn.invoice_id).first()
        if invoice:
            InvoiceService.recalculate_invoice_financials(db, invoice)

        db.commit()
        db.refresh(cn)
        return cn

    @classmethod
    def list_credit_notes(
        cls,
        db: Session,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        invoice_id: Optional[int] = None,
        reason: Optional[object] = None,
        status_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_amount: Optional[float] = None,
        max_amount: Optional[float] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[CreditNote], int]:
        query = (
            db.query(CreditNote)
            .join(CreditNote.customer)
            .join(CreditNote.invoice)
            .options(
                selectinload(CreditNote.items).selectinload(CreditNoteItem.product),
                selectinload(CreditNote.customer),
                selectinload(CreditNote.invoice),
                selectinload(CreditNote.creator),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    CreditNote.reference.ilike(s),
                    Invoice.reference.ilike(s),
                    BusinessPartner.legal_name.ilike(s),
                    BusinessPartner.code.ilike(s),
                    CreditNote.notes.ilike(s),
                )
            )

        if customer_id:
            query = query.filter(CreditNote.customer_id == customer_id)

        if invoice_id:
            query = query.filter(CreditNote.invoice_id == invoice_id)

        if reason:
            r_str = reason.value if hasattr(reason, "value") else str(reason)
            if r_str.strip().upper() != "ALL":
                query = query.filter(CreditNote.reason == r_str.strip().upper())

        if status_filter and status_filter.lower() != "all":
            query = query.filter(CreditNote.status == status_filter)

        if date_from:
            query = query.filter(CreditNote.credit_note_date >= date_from)

        if date_to:
            query = query.filter(CreditNote.credit_note_date <= date_to)

        if min_amount is not None:
            query = query.filter(CreditNote.total_ttc >= min_amount)

        if max_amount is not None:
            query = query.filter(CreditNote.total_ttc <= max_amount)

        total = query.count()
        items = query.order_by(CreditNote.credit_note_date.desc(), CreditNote.id.desc()).offset(skip).limit(limit).all()
        return items, total
