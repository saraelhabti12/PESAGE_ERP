import calendar
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.models.credit_note_model import CreditNote, CreditNoteStatus
from app.models.invoice_model import Invoice, InvoiceItem, InvoiceStatus, InvoiceType
from app.models.notification_model import Notification, NotificationType
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.payment_model import Payment
from app.models.purchase_model import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.sale_model import Sale, SaleItem, SaleStatus
from app.schemas.invoice_schemas import (
    InvoiceCreate,
    InvoiceFromPurchaseCreate,
    InvoiceFromSaleCreate,
    InvoiceUpdate,
)
from app.services.notification_services import NotificationService


class InvoiceService:
    @staticmethod
    def calculate_line_totals(
        quantity: float,
        unit_price_ht: float,
        tax_rate: float,
        discount_rate: float,
    ) -> Tuple[float, float, float, float]:
        gross = round(quantity * unit_price_ht, 2)
        line_discount = round(gross * (discount_rate / 100.0), 2)
        line_subtotal_ht = round(gross - line_discount, 2)
        line_tax = round(line_subtotal_ht * (tax_rate / 100.0), 2)
        line_total_ttc = round(line_subtotal_ht + line_tax, 2)
        return line_subtotal_ht, line_discount, line_tax, line_total_ttc

    @staticmethod
    def generate_invoice_reference(db: Session, invoice_type: InvoiceType = InvoiceType.CUSTOMER) -> str:
        """Generates a sequential invoice reference: FAC-YYYYMM-XXXX (client) or FF-YYYYMM-XXXX (fournisseur)."""
        now = datetime.now(timezone.utc)
        prefix = f"FAC-{now.strftime('%Y%m')}-" if invoice_type == InvoiceType.CUSTOMER else f"FF-{now.strftime('%Y%m')}-"
        count = db.query(func.count(Invoice.id)).filter(Invoice.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @staticmethod
    def calculate_due_date(invoice_date: datetime, payment_terms: Optional[str]) -> datetime:
        """Computes due date according to French business standard payment conditions."""
        if not payment_terms:
            return invoice_date + timedelta(days=30)

        terms_lower = payment_terms.strip().lower()

        if "comptant" in terms_lower or "immédiat" in terms_lower or "reception" in terms_lower or terms_lower in ("0", "0j", "0 j", "0 jours"):
            return invoice_date

        if "15" in terms_lower:
            return invoice_date + timedelta(days=15)
        if "45" in terms_lower and "fin de mois" not in terms_lower and "fdm" not in terms_lower:
            return invoice_date + timedelta(days=45)
        if "60" in terms_lower and "fin de mois" not in terms_lower and "fdm" not in terms_lower:
            return invoice_date + timedelta(days=60)
        if "90" in terms_lower:
            return invoice_date + timedelta(days=90)

        if "fin de mois" in terms_lower or "fdm" in terms_lower:
            year = invoice_date.year
            month = invoice_date.month
            last_day = calendar.monthrange(year, month)[1]
            end_of_month = invoice_date.replace(day=last_day)

            if "30" in terms_lower or "30j" in terms_lower:
                return end_of_month + timedelta(days=30)
            if "45" in terms_lower:
                return end_of_month + timedelta(days=45)
            if "60" in terms_lower:
                return end_of_month + timedelta(days=60)
            return end_of_month

        if "30" in terms_lower:
            return invoice_date + timedelta(days=30)

        return invoice_date + timedelta(days=30)

    @classmethod
    def recalculate_invoice_financials(cls, db: Session, invoice: Invoice) -> None:
        """Recalculates amount_paid, applicable credit notes, amount_due, and status server-side."""
        # Sum payments
        paid_sum = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
            Payment.invoice_id == invoice.id
        ).scalar() or 0.0

        # Sum active credit notes
        credit_sum = db.query(func.coalesce(func.sum(CreditNote.total_ttc), 0.0)).filter(
            CreditNote.invoice_id == invoice.id,
            CreditNote.status == CreditNoteStatus.ISSUED,
        ).scalar() or 0.0

        invoice.amount_paid = round(float(paid_sum), 2)
        total_ttc = round(float(invoice.total_ttc), 2)
        due = max(0.0, round(total_ttc - invoice.amount_paid - float(credit_sum), 2))
        invoice.amount_due = due

        now = datetime.now(timezone.utc)
        if invoice.status != InvoiceStatus.CANCELLED:
            if due <= 0.001 and total_ttc > 0:
                invoice.status = InvoiceStatus.PAID
            elif invoice.amount_paid > 0 or float(credit_sum) > 0:
                if invoice.due_date < now and due > 0:
                    invoice.status = InvoiceStatus.OVERDUE
                else:
                    invoice.status = InvoiceStatus.PARTIALLY_PAID
            else:
                if invoice.due_date < now and due > 0:
                    invoice.status = InvoiceStatus.OVERDUE
                else:
                    invoice.status = InvoiceStatus.ISSUED

    @classmethod
    def create_invoice(cls, db: Session, data: InvoiceCreate, user_id: int) -> Invoice:
        # Determine invoice type and partner
        inv_type = data.invoice_type or InvoiceType.CUSTOMER

        if inv_type == InvoiceType.CUSTOMER:
            if not data.customer_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le client est obligatoire pour une facture client.",
                )
            customer = db.query(BusinessPartner).filter(BusinessPartner.id == data.customer_id).first()
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le client avec l'ID {data.customer_id} n'existe pas.",
                )
            supplier_id = None
            customer_id = customer.id
        else:
            if not data.supplier_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le fournisseur est obligatoire pour une facture fournisseur.",
                )
            supplier = db.query(BusinessPartner).filter(BusinessPartner.id == data.supplier_id).first()
            if not supplier:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le fournisseur avec l'ID {data.supplier_id} n'existe pas.",
                )
            supplier_id = supplier.id
            customer_id = None

        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_invoice_reference(db, inv_type)
        existing = db.query(Invoice).filter(Invoice.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Une facture avec la référence '{reference}' existe déjà.",
            )

        invoice_date = data.invoice_date or datetime.now(timezone.utc)
        due_date = data.due_date or cls.calculate_due_date(invoice_date, data.payment_terms)

        invoice = Invoice(
            reference=reference,
            invoice_type=inv_type,
            customer_id=customer_id,
            supplier_id=supplier_id,
            sale_id=data.sale_id,
            purchase_order_id=data.purchase_order_id,
            invoice_date=invoice_date,
            due_date=due_date,
            status=InvoiceStatus.ISSUED,
            payment_terms=data.payment_terms,
            payment_method=data.payment_method,
            notes=data.notes,
            created_by=user_id,
        )

        total_subtotal_ht = 0.0
        total_discount_amount = 0.0
        total_tax_amount = 0.0
        total_ttc = 0.0

        for item_data in data.items:
            qty = float(item_data.quantity)
            price = float(item_data.unit_price_ht) if item_data.unit_price_ht is not None else 0.00
            tax_rate = float(item_data.tax_rate) if item_data.tax_rate is not None else 20.00
            discount_rate = float(item_data.discount_rate) if item_data.discount_rate is not None else 0.00

            if qty <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La quantité facturée doit être strictement supérieure à 0.",
                )

            line_subtotal, line_discount, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

            invoice_item = InvoiceItem(
                product_id=item_data.product_id,
                description=item_data.description,
                quantity=qty,
                unit_price_ht=price,
                tax_rate=tax_rate,
                discount_rate=discount_rate,
                line_subtotal_ht=line_subtotal,
                line_discount=line_discount,
                line_tax=line_tax,
                line_total_ttc=line_ttc,
            )
            invoice.items.append(invoice_item)

            total_subtotal_ht += line_subtotal
            total_discount_amount += line_discount
            total_tax_amount += line_tax
            total_ttc += line_ttc

        invoice.subtotal_ht = round(total_subtotal_ht, 2)
        invoice.discount_amount = round(total_discount_amount, 2)
        invoice.tax_amount = round(total_tax_amount, 2)
        invoice.total_ttc = round(total_ttc, 2)
        invoice.amount_paid = 0.00
        invoice.amount_due = invoice.total_ttc

        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice

    @classmethod
    def create_invoice_from_sale(cls, db: Session, data: InvoiceFromSaleCreate, user_id: int) -> Invoice:
        sale = (
            db.query(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.customer),
            )
            .filter(Sale.id == data.sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        if sale.status == SaleStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de générer une facture pour une vente annulée.",
            )

        existing_inv = db.query(Invoice).filter(
            Invoice.sale_id == sale.id,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).first()
        if existing_inv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Une facture client existe déjà pour cette vente ({existing_inv.reference}).",
            )

        invoice_date = data.invoice_date or datetime.now(timezone.utc)
        payment_terms = data.payment_terms or sale.payment_terms or "30 jours"
        due_date = cls.calculate_due_date(invoice_date, payment_terms)

        reference = cls.generate_invoice_reference(db, InvoiceType.CUSTOMER)

        invoice = Invoice(
            reference=reference,
            invoice_type=InvoiceType.CUSTOMER,
            customer_id=sale.customer_id,
            sale_id=sale.id,
            invoice_date=invoice_date,
            due_date=due_date,
            status=InvoiceStatus.ISSUED,
            payment_terms=payment_terms,
            payment_method=data.payment_method or sale.payment_method,
            notes=data.notes or (f"Facture générée depuis la vente {sale.reference}." + (f" {sale.notes}" if sale.notes else "")),
            subtotal_ht=sale.subtotal_ht,
            discount_amount=sale.discount_amount,
            tax_amount=sale.tax_amount,
            total_ttc=sale.total_ttc,
            amount_paid=0.00,
            amount_due=sale.total_ttc,
            created_by=user_id,
        )

        for s_item in sale.items:
            prod_name = s_item.product.designation if s_item.product else f"Produit #{s_item.product_id}"
            inv_item = InvoiceItem(
                product_id=s_item.product_id,
                description=prod_name,
                quantity=s_item.quantity,
                unit_price_ht=s_item.unit_price_ht,
                tax_rate=s_item.tax_rate,
                discount_rate=s_item.discount_rate,
                line_subtotal_ht=s_item.line_subtotal_ht,
                line_discount=s_item.line_discount,
                line_tax=s_item.line_tax,
                line_total_ttc=s_item.line_total_ttc,
            )
            invoice.items.append(inv_item)

        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        NotificationService.create_notification(
            db=db,
            title="Facture client émise",
            message=f"La facture {invoice.reference} pour la vente {sale.reference} a été émise.",
            type=NotificationType.SUCCESS,
            user_id=user_id,
            link="/factures",
        )

        return invoice

    @classmethod
    def create_invoice_from_purchase_order(cls, db: Session, data: InvoiceFromPurchaseCreate, user_id: int) -> Invoice:
        po = (
            db.query(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
                selectinload(PurchaseOrder.supplier),
            )
            .filter(PurchaseOrder.id == data.purchase_order_id)
            .first()
        )
        if not po:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande d'achat introuvable.")

        if po.status == PurchaseOrderStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de générer une facture pour un bon de commande annulé.",
            )

        existing_inv = db.query(Invoice).filter(
            Invoice.purchase_order_id == po.id,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).first()
        if existing_inv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Une facture fournisseur existe déjà pour cette commande ({existing_inv.reference}).",
            )

        invoice_date = data.invoice_date or datetime.now(timezone.utc)
        payment_terms = data.payment_terms or "30 jours"
        due_date = data.due_date or cls.calculate_due_date(invoice_date, payment_terms)

        reference = cls.generate_invoice_reference(db, InvoiceType.SUPPLIER)

        total_discount = 0.0
        invoice_items = []
        for p_item in po.items:
            prod_name = p_item.product.designation if p_item.product else f"Article #{p_item.product_id}"
            qty = float(p_item.quantity_ordered)
            unit_p = float(p_item.unit_price_ht)
            disc_r = float(p_item.discount_rate or 0.0)
            disc_amt = round(qty * unit_p * (disc_r / 100.0), 2)
            total_discount += disc_amt
            inv_item = InvoiceItem(
                product_id=p_item.product_id,
                description=prod_name,
                quantity=qty,
                unit_price_ht=unit_p,
                tax_rate=float(p_item.tax_rate),
                discount_rate=disc_r,
                line_subtotal_ht=float(p_item.line_subtotal_ht),
                line_discount=disc_amt,
                line_tax=float(p_item.line_tax),
                line_total_ttc=float(p_item.line_total_ttc),
            )
            invoice_items.append(inv_item)

        invoice = Invoice(
            reference=reference,
            invoice_type=InvoiceType.SUPPLIER,
            supplier_id=po.supplier_id,
            purchase_order_id=po.id,
            invoice_date=invoice_date,
            due_date=due_date,
            status=InvoiceStatus.ISSUED,
            payment_terms=payment_terms,
            payment_method=data.payment_method,
            notes=data.notes or (f"Facture fournisseur générée depuis le bon de commande {po.reference}." + (f" {po.notes}" if po.notes else "")),
            subtotal_ht=po.subtotal_ht,
            discount_amount=round(total_discount, 2),
            tax_amount=po.tax_amount,
            total_ttc=po.total_ttc,
            amount_paid=0.00,
            amount_due=po.total_ttc,
            created_by=user_id,
        )
        invoice.items = invoice_items

        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        NotificationService.create_notification(
            db=db,
            title="Facture fournisseur enregistrée",
            message=f"La facture fournisseur {invoice.reference} pour la commande {po.reference} a été enregistrée.",
            type=NotificationType.SUCCESS,
            user_id=user_id,
            link="/factures-fournisseurs",
        )

        return invoice

    @classmethod
    def update_invoice(cls, db: Session, invoice_id: int, data: InvoiceUpdate) -> Invoice:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")

        if invoice.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Impossible de modifier une facture au statut '{invoice.status.value}'.",
            )

        if data.due_date is not None:
            invoice.due_date = data.due_date
        if data.payment_terms is not None:
            invoice.payment_terms = data.payment_terms
            if data.due_date is None:
                invoice.due_date = cls.calculate_due_date(invoice.invoice_date, data.payment_terms)
        if data.payment_method is not None:
            invoice.payment_method = data.payment_method
        if data.notes is not None:
            invoice.notes = data.notes

        invoice.updated_at = datetime.now(timezone.utc)
        cls.recalculate_invoice_financials(db, invoice)
        db.commit()
        db.refresh(invoice)
        return invoice

    @classmethod
    def cancel_invoice(cls, db: Session, invoice_id: int) -> Invoice:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")

        if float(invoice.amount_paid) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d'annuler une facture ayant déjà des paiements enregistrés. Veuillez d'abord supprimer ou annuler les règlements.",
            )

        invoice.status = InvoiceStatus.CANCELLED
        invoice.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(invoice)
        return invoice

    @classmethod
    def get_invoice(cls, db: Session, invoice_id: int) -> Invoice:
        invoice = (
            db.query(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.payments),
                selectinload(Invoice.credit_notes),
                selectinload(Invoice.customer),
                selectinload(Invoice.supplier),
                selectinload(Invoice.sale),
                selectinload(Invoice.purchase_order),
                selectinload(Invoice.creator),
            )
            .filter(Invoice.id == invoice_id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")

        cls.recalculate_invoice_financials(db, invoice)
        db.commit()

        # Compute dynamic date metrics
        now = datetime.now(timezone.utc)
        delta_days = (invoice.due_date - now).days
        if delta_days >= 0:
            invoice.days_until_due = delta_days
            invoice.days_overdue = 0
        else:
            invoice.days_until_due = 0
            invoice.days_overdue = abs(delta_days)

        return invoice

    @classmethod
    def list_invoices(
        cls,
        db: Session,
        search: Optional[str] = None,
        invoice_type: Optional[InvoiceType] = None,
        customer_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        sale_id: Optional[int] = None,
        purchase_order_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_amount: Optional[float] = None,
        max_amount: Optional[float] = None,
        payment_method: Optional[str] = None,
        overdue_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Invoice], int]:
        now = datetime.now(timezone.utc)

        # Batch update overdue invoices
        db.query(Invoice).filter(
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]),
            Invoice.due_date < now,
            Invoice.amount_due > 0,
        ).update({"status": InvoiceStatus.OVERDUE}, synchronize_session=False)
        db.commit()

        query = (
            db.query(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.payments),
                selectinload(Invoice.credit_notes),
                selectinload(Invoice.customer),
                selectinload(Invoice.supplier),
                selectinload(Invoice.sale),
                selectinload(Invoice.purchase_order),
                selectinload(Invoice.creator),
            )
        )

        if invoice_type:
            query = query.filter(Invoice.invoice_type == invoice_type)

        if search:
            s = f"%{search.strip()}%"
            CustomerPartner = aliased(BusinessPartner)
            SupplierPartner = aliased(BusinessPartner)
            query = (
                query
                .outerjoin(CustomerPartner, Invoice.customer_id == CustomerPartner.id)
                .outerjoin(SupplierPartner, Invoice.supplier_id == SupplierPartner.id)
                .filter(
                    or_(
                        Invoice.reference.ilike(s),
                        CustomerPartner.legal_name.ilike(s),
                        CustomerPartner.trade_name.ilike(s),
                        CustomerPartner.code.ilike(s),
                        SupplierPartner.legal_name.ilike(s),
                        SupplierPartner.trade_name.ilike(s),
                        SupplierPartner.code.ilike(s),
                        Invoice.notes.ilike(s),
                    )
                )
            )

        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)

        if supplier_id:
            query = query.filter(Invoice.supplier_id == supplier_id)

        if sale_id:
            query = query.filter(Invoice.sale_id == sale_id)

        if purchase_order_id:
            query = query.filter(Invoice.purchase_order_id == purchase_order_id)

        if overdue_only:
            query = query.filter(Invoice.status == InvoiceStatus.OVERDUE)
        elif status_filter and status_filter.lower() != "all":
            query = query.filter(Invoice.status == status_filter)

        if date_from:
            query = query.filter(Invoice.invoice_date >= date_from)

        if date_to:
            query = query.filter(Invoice.invoice_date <= date_to)

        if min_amount is not None:
            query = query.filter(Invoice.total_ttc >= min_amount)

        if max_amount is not None:
            query = query.filter(Invoice.total_ttc <= max_amount)

        if payment_method:
            query = query.filter(Invoice.payment_method.ilike(f"%{payment_method}%"))

        total = query.count()
        invoices = query.order_by(Invoice.invoice_date.desc(), Invoice.id.desc()).offset(skip).limit(limit).all()

        for inv in invoices:
            delta_days = (inv.due_date - now).days
            if delta_days >= 0:
                inv.days_until_due = delta_days
                inv.days_overdue = 0
            else:
                inv.days_until_due = 0
                inv.days_overdue = abs(delta_days)

        return invoices, total

    @classmethod
    def check_and_notify_due_invoices(cls, db: Session) -> dict:
        """Idempotent scheduled check for upcoming and overdue invoice alerts."""
        now = datetime.now(timezone.utc)
        today = now.date()

        invoices = db.query(Invoice).filter(
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
            Invoice.amount_due > 0,
        ).all()

        alerts_created = 0

        for inv in invoices:
            due_date = inv.due_date.date()
            days_diff = (due_date - today).days

            # 7 days before
            if days_diff == 7:
                msg = f"Facture {inv.reference} arrive à échéance dans 7 jours (Échéance: {due_date.strftime('%d/%m/%Y')})."
                exists = db.query(Notification).filter(
                    Notification.message == msg,
                    func.date(Notification.created_at) == today,
                ).first()
                if not exists:
                    NotificationService.create_notification(
                        db=db,
                        title="Échéance facture proche (7 jours)",
                        message=msg,
                        type=NotificationType.WARNING,
                        user_id=inv.created_by,
                        link="/factures" if inv.invoice_type == InvoiceType.CUSTOMER else "/factures-fournisseurs",
                    )
                    alerts_created += 1

            # On due date
            elif days_diff == 0:
                msg = f"Facture {inv.reference} arrive à échéance aujourd'hui."
                exists = db.query(Notification).filter(
                    Notification.message == msg,
                    func.date(Notification.created_at) == today,
                ).first()
                if not exists:
                    NotificationService.create_notification(
                        db=db,
                        title="Facture à échéance aujourd'hui",
                        message=msg,
                        type=NotificationType.WARNING,
                        user_id=inv.created_by,
                        link="/factures" if inv.invoice_type == InvoiceType.CUSTOMER else "/factures-fournisseurs",
                    )
                    alerts_created += 1

            # Overdue
            elif days_diff < 0:
                if inv.status != InvoiceStatus.OVERDUE:
                    inv.status = InvoiceStatus.OVERDUE
                    db.commit()

                msg = f"Facture {inv.reference} est en retard de paiement de {abs(days_diff)} jour(s)."
                exists = db.query(Notification).filter(
                    Notification.message == msg,
                    func.date(Notification.created_at) == today,
                ).first()
                if not exists:
                    NotificationService.create_notification(
                        db=db,
                        title="Facture en retard de paiement",
                        message=msg,
                        type=NotificationType.ERROR,
                        user_id=inv.created_by,
                        link="/factures" if inv.invoice_type == InvoiceType.CUSTOMER else "/factures-fournisseurs",
                    )
                    alerts_created += 1

        return {"status": "ok", "alerts_created": alerts_created, "invoices_checked": len(invoices)}

    @classmethod
    def get_invoiceable_sales(cls, db: Session) -> List[Sale]:
        """Returns all confirmed/delivered sales that do not have an active customer invoice."""
        invoiced_sale_ids = select(Invoice.sale_id).filter(
            Invoice.sale_id.isnot(None),
            Invoice.status != InvoiceStatus.CANCELLED,
        )

        return (
            db.query(Sale)
            .options(
                selectinload(Sale.customer),
                selectinload(Sale.creator),
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.warehouse),
            )
            .filter(
                Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.DELIVERED, SaleStatus.PARTIALLY_DELIVERED]),
                ~Sale.id.in_(invoiced_sale_ids),
            )
            .order_by(Sale.order_date.desc(), Sale.id.desc())
            .all()
        )

    @classmethod
    def get_invoiceable_purchases(cls, db: Session) -> List[PurchaseOrder]:
        """Returns all approved/received purchase orders that do not have an active supplier invoice."""
        invoiced_po_ids = select(Invoice.purchase_order_id).filter(
            Invoice.purchase_order_id.isnot(None),
            Invoice.status != InvoiceStatus.CANCELLED,
        )

        return (
            db.query(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.creator),
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
            )
            .filter(
                PurchaseOrder.status.in_([
                    PurchaseOrderStatus.APPROVED,
                    PurchaseOrderStatus.PARTIALLY_RECEIVED,
                    PurchaseOrderStatus.RECEIVED,
                ]),
                ~PurchaseOrder.id.in_(invoiced_po_ids),
            )
            .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc())
            .all()
        )
