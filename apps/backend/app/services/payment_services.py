from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.invoice_model import Invoice, InvoiceStatus
from app.models.notification_model import NotificationType
from app.models.partner_model import BusinessPartner
from app.models.payment_model import Payment
from app.schemas.payment_schemas import CustomerFinancialSummary, PaymentCreate
from app.services.notification_services import NotificationService


class PaymentService:
    @staticmethod
    def generate_payment_reference(db: Session) -> str:
        """Generates a sequential payment reference like PAY-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"PAY-{now.strftime('%Y%m')}-"
        count = db.query(func.count(Payment.id)).filter(Payment.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_payment(cls, db: Session, data: PaymentCreate, user_id: int) -> Payment:
        # 1. Validate Invoice
        invoice = (
            db.query(Invoice)
            .options(
                selectinload(Invoice.customer),
            )
            .filter(Invoice.id == data.invoice_id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")

        if invoice.status == InvoiceStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d'enregistrer un paiement pour une facture annulée.",
            )

        if invoice.status == InvoiceStatus.PAID or float(invoice.amount_due) <= 0.001:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La facture {invoice.reference} est déjà intégralement payée.",
            )

        pay_amount = round(float(data.amount), 2)
        if pay_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le montant du paiement doit être strictement supérieur à 0.",
            )

        current_due = float(invoice.amount_due)
        if pay_amount > current_due + 1e-4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le montant ({pay_amount:.2f} DH) dépasse le solde restant dû ({current_due:.2f} DH).",
            )

        # 2. Reference validation or generation
        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_payment_reference(db)
        existing = db.query(Payment).filter(Payment.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un paiement avec la référence '{reference}' existe déjà.",
            )

        payment_date = data.payment_date or datetime.now(timezone.utc)

        partner_id = invoice.customer_id or invoice.supplier_id
        payment = Payment(
            reference=reference,
            invoice_id=invoice.id,
            customer_id=partner_id,
            payment_date=payment_date,
            amount=pay_amount,
            payment_method=data.payment_method,
            transaction_reference=data.transaction_reference,
            notes=data.notes,
            created_by=user_id,
        )
        db.add(payment)

        # 3. Update Invoice balances and status
        new_paid = round(float(invoice.amount_paid) + pay_amount, 2)
        new_due = max(0.0, round(float(invoice.total_ttc) - new_paid, 2))

        invoice.amount_paid = new_paid
        invoice.amount_due = new_due

        if new_due <= 0.001:
            invoice.status = InvoiceStatus.PAID
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        invoice.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(payment)
        db.refresh(invoice)

        # Notify
        NotificationService.create_notification(
            db=db,
            title="Paiement enregistré",
            message=f"Règlement {payment.reference} de {payment.amount:.2f} DH reçu pour la facture {invoice.reference}.",
            type=NotificationType.SUCCESS,
            user_id=user_id,
            link="/factures",
        )

        return payment

    @classmethod
    def delete_payment(cls, db: Session, payment_id: int) -> None:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paiement introuvable.")

        invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
        if invoice:
            new_paid = max(0.0, round(float(invoice.amount_paid) - float(payment.amount), 2))
            new_due = max(0.0, round(float(invoice.total_ttc) - new_paid, 2))

            invoice.amount_paid = new_paid
            invoice.amount_due = new_due

            now = datetime.now(timezone.utc)
            if new_due <= 0.001:
                invoice.status = InvoiceStatus.PAID
            elif new_paid > 0:
                invoice.status = InvoiceStatus.PARTIALLY_PAID
            else:
                if invoice.due_date < now:
                    invoice.status = InvoiceStatus.OVERDUE
                else:
                    invoice.status = InvoiceStatus.ISSUED

            invoice.updated_at = datetime.now(timezone.utc)

        db.delete(payment)
        db.commit()

    @staticmethod
    def get_payment(db: Session, payment_id: int) -> Payment:
        payment = (
            db.query(Payment)
            .options(
                selectinload(Payment.customer),
                selectinload(Payment.invoice),
                selectinload(Payment.creator),
            )
            .filter(Payment.id == payment_id)
            .first()
        )
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paiement introuvable.")
        return payment

    @staticmethod
    def list_payments(
        db: Session,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        invoice_id: Optional[int] = None,
        payment_method: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Payment], int]:
        query = (
            db.query(Payment)
            .join(Payment.customer)
            .join(Payment.invoice)
            .options(
                selectinload(Payment.customer),
                selectinload(Payment.invoice),
                selectinload(Payment.creator),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Payment.reference.ilike(s),
                    Payment.transaction_reference.ilike(s),
                    Invoice.reference.ilike(s),
                    BusinessPartner.legal_name.ilike(s),
                    BusinessPartner.trade_name.ilike(s),
                )
            )

        if customer_id:
            query = query.filter(Payment.customer_id == customer_id)

        if invoice_id:
            query = query.filter(Payment.invoice_id == invoice_id)

        if payment_method and payment_method != "all":
            query = query.filter(Payment.payment_method == payment_method)

        if date_from:
            query = query.filter(Payment.payment_date >= date_from)

        if date_to:
            query = query.filter(Payment.payment_date <= date_to)

        total = query.count()
        payments = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).offset(skip).limit(limit).all()
        return payments, total

    @staticmethod
    def get_customer_financial_summary(db: Session, customer_id: int) -> CustomerFinancialSummary:
        customer = db.query(BusinessPartner).filter(BusinessPartner.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client introuvable.")

        invoices = (
            db.query(Invoice)
            .filter(
                Invoice.customer_id == customer_id,
                Invoice.status != InvoiceStatus.CANCELLED,
            )
            .all()
        )

        total_invoiced = sum(float(inv.total_ttc) for inv in invoices)
        total_paid = sum(float(inv.amount_paid) for inv in invoices)
        balance_due = max(0.0, round(total_invoiced - total_paid, 2))
        unpaid_count = sum(1 for inv in invoices if float(inv.amount_due) > 0.001)

        return CustomerFinancialSummary(
            customer_id=customer_id,
            total_invoiced=round(total_invoiced, 2),
            total_paid=round(total_paid, 2),
            balance_due=balance_due,
            invoice_count=len(invoices),
            unpaid_invoice_count=unpaid_count,
        )
