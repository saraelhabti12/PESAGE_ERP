from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import case, func, or_, text
from sqlalchemy.orm import Session

from app.models.category_model import Category
from app.models.credit_note_model import CreditNote, CreditNoteStatus
from app.models.expense_model import Expense, ExpenseStatus
from app.models.invoice_model import Invoice, InvoiceStatus, InvoiceType
from app.models.partner_model import BusinessPartner
from app.models.payment_model import Payment
from app.models.product_model import Product
from app.models.purchase_model import PurchaseOrder, PurchaseOrderStatus
from app.models.quote_model import Quote, QuoteStatus
from app.models.sale_model import Sale, SaleItem, SaleStatus
from app.schemas.report_schemas import (
    CommercialReportResponse,
    CommercialReportsBundle,
    CommercialStatistics,
    MonthlyTrendMarginItem,
    MonthlyTrendReportItem,
    OverdueInvoiceReportItem,
    PartnerPerformanceReportItem,
    TopCustomerReport,
    TopProductReport,
)


class CommercialStatisticsService:
    @classmethod
    def get_commercial_statistics(
        cls,
        db: Session,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
    ) -> CommercialStatistics:
        now = datetime.now(timezone.utc)

        # 1. Quotes
        q_query = db.query(Quote)
        if date_from:
            q_query = q_query.filter(Quote.quote_date >= date_from)
        if date_to:
            q_query = q_query.filter(Quote.quote_date <= date_to)
        if customer_id:
            q_query = q_query.filter(Quote.customer_id == customer_id)

        quotes_total = q_query.count()
        quotes_accepted = q_query.filter(Quote.status == QuoteStatus.ACCEPTED).count()
        quotes_pending = q_query.filter(Quote.status.in_([QuoteStatus.DRAFT, QuoteStatus.SENT])).count()

        # 2. Sales
        s_query = db.query(Sale)
        if date_from:
            s_query = s_query.filter(Sale.order_date >= date_from)
        if date_to:
            s_query = s_query.filter(Sale.order_date <= date_to)
        if customer_id:
            s_query = s_query.filter(Sale.customer_id == customer_id)

        sales_total = s_query.count()
        sales_confirmed = s_query.filter(Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED])).count()
        sales_cancelled = s_query.filter(Sale.status == SaleStatus.CANCELLED).count()

        sales_ht = db.query(func.coalesce(func.sum(Sale.subtotal_ht), 0.0)).filter(
            Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]),
            *([Sale.order_date >= date_from] if date_from else []),
            *([Sale.order_date <= date_to] if date_to else []),
            *([Sale.customer_id == customer_id] if customer_id else []),
        ).scalar() or 0.0

        sales_ttc = db.query(func.coalesce(func.sum(Sale.total_ttc), 0.0)).filter(
            Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]),
            *([Sale.order_date >= date_from] if date_from else []),
            *([Sale.order_date <= date_to] if date_to else []),
            *([Sale.customer_id == customer_id] if customer_id else []),
        ).scalar() or 0.0

        # 3. Customer Invoices
        inv_query = db.query(Invoice).filter(Invoice.invoice_type == InvoiceType.CUSTOMER)
        if date_from:
            inv_query = inv_query.filter(Invoice.invoice_date >= date_from)
        if date_to:
            inv_query = inv_query.filter(Invoice.invoice_date <= date_to)
        if customer_id:
            inv_query = inv_query.filter(Invoice.customer_id == customer_id)

        invoices_total = inv_query.count()
        invoices_paid = inv_query.filter(Invoice.status == InvoiceStatus.PAID).count()
        invoices_partial = inv_query.filter(Invoice.status == InvoiceStatus.PARTIALLY_PAID).count()
        invoices_unpaid = inv_query.filter(Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.DRAFT])).count()
        invoices_overdue = inv_query.filter(
            or_(
                Invoice.status == InvoiceStatus.OVERDUE,
                (Invoice.due_date < now) & (Invoice.amount_due > 0) & (Invoice.status != InvoiceStatus.CANCELLED),
            )
        ).count()

        total_invoiced = db.query(func.coalesce(func.sum(Invoice.total_ttc), 0.0)).filter(
            Invoice.invoice_type == InvoiceType.CUSTOMER,
            Invoice.status != InvoiceStatus.CANCELLED,
            *([Invoice.invoice_date >= date_from] if date_from else []),
            *([Invoice.invoice_date <= date_to] if date_to else []),
            *([Invoice.customer_id == customer_id] if customer_id else []),
        ).scalar() or 0.0

        total_paid = db.query(func.coalesce(func.sum(Invoice.amount_paid), 0.0)).filter(
            Invoice.invoice_type == InvoiceType.CUSTOMER,
            Invoice.status != InvoiceStatus.CANCELLED,
            *([Invoice.invoice_date >= date_from] if date_from else []),
            *([Invoice.invoice_date <= date_to] if date_to else []),
            *([Invoice.customer_id == customer_id] if customer_id else []),
        ).scalar() or 0.0

        total_due = db.query(func.coalesce(func.sum(Invoice.amount_due), 0.0)).filter(
            Invoice.invoice_type == InvoiceType.CUSTOMER,
            Invoice.status != InvoiceStatus.CANCELLED,
            *([Invoice.invoice_date >= date_from] if date_from else []),
            *([Invoice.invoice_date <= date_to] if date_to else []),
            *([Invoice.customer_id == customer_id] if customer_id else []),
        ).scalar() or 0.0

        # 4. Credit Notes
        cn_query = db.query(CreditNote).filter(CreditNote.status == CreditNoteStatus.ISSUED)
        if date_from:
            cn_query = cn_query.filter(CreditNote.credit_note_date >= date_from)
        if date_to:
            cn_query = cn_query.filter(CreditNote.credit_note_date <= date_to)
        if customer_id:
            cn_query = cn_query.filter(CreditNote.customer_id == customer_id)

        credit_notes_total = cn_query.count()
        credit_notes_amount = db.query(func.coalesce(func.sum(CreditNote.total_ttc), 0.0)).filter(
            CreditNote.status == CreditNoteStatus.ISSUED,
            *([CreditNote.credit_note_date >= date_from] if date_from else []),
            *([CreditNote.credit_note_date <= date_to] if date_to else []),
            *([CreditNote.customer_id == customer_id] if customer_id else []),
        ).scalar() or 0.0

        # 5. Purchases & Supplier Invoices
        po_query = db.query(PurchaseOrder)
        if date_from:
            po_query = po_query.filter(PurchaseOrder.order_date >= date_from)
        if date_to:
            po_query = po_query.filter(PurchaseOrder.order_date <= date_to)
        if supplier_id:
            po_query = po_query.filter(PurchaseOrder.supplier_id == supplier_id)

        purchases_total = po_query.count()
        purchases_ttc = db.query(func.coalesce(func.sum(PurchaseOrder.total_ttc), 0.0)).filter(
            PurchaseOrder.status.in_([PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED]),
            *([PurchaseOrder.order_date >= date_from] if date_from else []),
            *([PurchaseOrder.order_date <= date_to] if date_to else []),
            *([PurchaseOrder.supplier_id == supplier_id] if supplier_id else []),
        ).scalar() or 0.0

        supplier_due = db.query(func.coalesce(func.sum(Invoice.amount_due), 0.0)).filter(
            Invoice.invoice_type == InvoiceType.SUPPLIER,
            Invoice.status != InvoiceStatus.CANCELLED,
            *([Invoice.supplier_id == supplier_id] if supplier_id else []),
        ).scalar() or 0.0

        return CommercialStatistics(
            quotes_total=quotes_total,
            quotes_accepted=quotes_accepted,
            quotes_pending=quotes_pending,
            sales_total=sales_total,
            sales_confirmed=sales_confirmed,
            sales_cancelled=sales_cancelled,
            sales_total_ht=round(float(sales_ht), 2),
            sales_total_ttc=round(float(sales_ttc), 2),
            invoices_total=invoices_total,
            invoices_paid=invoices_paid,
            invoices_partial=invoices_partial,
            invoices_unpaid=invoices_unpaid,
            invoices_overdue=invoices_overdue,
            total_invoiced_ttc=round(float(total_invoiced), 2),
            total_paid=round(float(total_paid), 2),
            total_due=round(float(total_due), 2),
            credit_notes_total=credit_notes_total,
            credit_notes_amount=round(float(credit_notes_amount), 2),
            purchases_total=purchases_total,
            purchases_total_ttc=round(float(purchases_ttc), 2),
            supplier_amount_due=round(float(supplier_due), 2),
        )

    @classmethod
    def get_commercial_reports(cls, db: Session) -> CommercialReportsBundle:
        now = datetime.now(timezone.utc)

        # Monthly Trends (last 6 months)
        sales_by_month = []
        invoices_by_month = []
        payments_by_month = []
        purchases_by_month = []

        for i in range(5, -1, -1):
            m_year = now.year
            m_month = now.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1

            m_start = datetime(m_year, m_month, 1, tzinfo=timezone.utc)
            m_end = datetime(m_year + 1, 1, 1, tzinfo=timezone.utc) if m_month == 12 else datetime(m_year, m_month + 1, 1, tzinfo=timezone.utc)
            m_label = f"{m_month:02d}/{m_year}"

            # Sales
            s_sum = db.query(func.coalesce(func.sum(Sale.total_ttc), 0.0), func.count(Sale.id)).filter(
                Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]),
                Sale.order_date >= m_start,
                Sale.order_date < m_end,
            ).first() or (0.0, 0)
            sales_by_month.append(MonthlyTrendReportItem(month=m_label, amount=round(float(s_sum[0]), 2), count=s_sum[1]))

            # Invoices
            inv_sum = db.query(func.coalesce(func.sum(Invoice.total_ttc), 0.0), func.count(Invoice.id)).filter(
                Invoice.invoice_type == InvoiceType.CUSTOMER,
                Invoice.status != InvoiceStatus.CANCELLED,
                Invoice.invoice_date >= m_start,
                Invoice.invoice_date < m_end,
            ).first() or (0.0, 0)
            invoices_by_month.append(MonthlyTrendReportItem(month=m_label, amount=round(float(inv_sum[0]), 2), count=inv_sum[1]))

            # Payments
            pay_sum = db.query(func.coalesce(func.sum(Payment.amount), 0.0), func.count(Payment.id)).filter(
                Payment.payment_date >= m_start,
                Payment.payment_date < m_end,
            ).first() or (0.0, 0)
            payments_by_month.append(MonthlyTrendReportItem(month=m_label, amount=round(float(pay_sum[0]), 2), count=pay_sum[1]))

            # Purchases
            po_sum = db.query(func.coalesce(func.sum(PurchaseOrder.total_ttc), 0.0), func.count(PurchaseOrder.id)).filter(
                PurchaseOrder.status.in_([PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED]),
                PurchaseOrder.order_date >= m_start,
                PurchaseOrder.order_date < m_end,
            ).first() or (0.0, 0)
            purchases_by_month.append(MonthlyTrendReportItem(month=m_label, amount=round(float(po_sum[0]), 2), count=po_sum[1]))

        # Top Customers by Revenue
        top_cust_rows = (
            db.query(
                BusinessPartner.id,
                BusinessPartner.code,
                BusinessPartner.legal_name,
                func.coalesce(func.sum(Sale.total_ttc), 0.0).label("tot"),
                func.count(Sale.id).label("cnt"),
            )
            .join(Sale, Sale.customer_id == BusinessPartner.id)
            .filter(Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]))
            .group_by(BusinessPartner.id, BusinessPartner.code, BusinessPartner.legal_name)
            .order_by(text("tot DESC"))
            .limit(10)
            .all()
        )
        top_customers = [
            PartnerPerformanceReportItem(
                partner_id=r[0],
                partner_code=r[1],
                partner_name=r[2],
                total_amount=round(float(r[3]), 2),
                document_count=r[4],
            )
            for r in top_cust_rows
        ]

        # Top Suppliers by Purchases
        top_supp_rows = (
            db.query(
                BusinessPartner.id,
                BusinessPartner.code,
                BusinessPartner.legal_name,
                func.coalesce(func.sum(PurchaseOrder.total_ttc), 0.0).label("tot"),
                func.count(PurchaseOrder.id).label("cnt"),
            )
            .join(PurchaseOrder, PurchaseOrder.supplier_id == BusinessPartner.id)
            .filter(PurchaseOrder.status.in_([PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED]))
            .group_by(BusinessPartner.id, BusinessPartner.code, BusinessPartner.legal_name)
            .order_by(text("tot DESC"))
            .limit(10)
            .all()
        )
        top_suppliers = [
            PartnerPerformanceReportItem(
                partner_id=r[0],
                partner_code=r[1],
                partner_name=r[2],
                total_amount=round(float(r[3]), 2),
                document_count=r[4],
            )
            for r in top_supp_rows
        ]

        # Overdue Invoices
        overdue_rows = (
            db.query(Invoice)
            .join(Invoice.customer)
            .filter(
                Invoice.invoice_type == InvoiceType.CUSTOMER,
                Invoice.amount_due > 0,
                Invoice.status != InvoiceStatus.CANCELLED,
                Invoice.due_date < now,
            )
            .order_by(Invoice.due_date.asc())
            .limit(20)
            .all()
        )

        overdue_list = []
        for inv in overdue_rows:
            days = abs((inv.due_date - now).days)
            overdue_list.append(
                OverdueInvoiceReportItem(
                    invoice_id=inv.id,
                    reference=inv.reference,
                    partner_name=inv.customer.legal_name if inv.customer else "Client Inconnu",
                    due_date=inv.due_date.strftime("%d/%m/%Y"),
                    days_overdue=days,
                    total_ttc=round(float(inv.total_ttc), 2),
                    amount_due=round(float(inv.amount_due), 2),
                )
            )

        return CommercialReportsBundle(
            sales_by_month=sales_by_month,
            invoices_by_month=invoices_by_month,
            payments_by_month=payments_by_month,
            purchases_by_month=purchases_by_month,
            top_customers_by_revenue=top_customers,
            top_suppliers_by_purchases=top_suppliers,
            overdue_invoices=overdue_list,
        )

    @classmethod
    def get_commercial_report(
        cls,
        db: Session,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> CommercialReportResponse:
        now = datetime.now(timezone.utc)
        stats = cls.get_commercial_statistics(db=db, date_from=date_from, date_to=date_to)

        # Top Customers
        top_cust_query = (
            db.query(
                BusinessPartner.id,
                BusinessPartner.code,
                BusinessPartner.legal_name,
                func.coalesce(func.sum(Sale.subtotal_ht), 0.0).label("tot_ht"),
                func.coalesce(func.sum(Sale.total_ttc), 0.0).label("tot_ttc"),
                func.count(Sale.id).label("cnt"),
            )
            .join(Sale, Sale.customer_id == BusinessPartner.id)
            .filter(Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]))
        )
        if date_from:
            top_cust_query = top_cust_query.filter(Sale.order_date >= date_from)
        if date_to:
            top_cust_query = top_cust_query.filter(Sale.order_date <= date_to)
        top_cust_rows = (
            top_cust_query.group_by(BusinessPartner.id, BusinessPartner.code, BusinessPartner.legal_name)
            .order_by(text("tot_ttc DESC"))
            .limit(10)
            .all()
        )

        top_customers = [
            TopCustomerReport(
                customer_id=r[0],
                code=r[1],
                name=r[2],
                total_ht=round(float(r[3]), 2),
                total_ttc=round(float(r[4]), 2),
                orders_count=r[5],
            )
            for r in top_cust_rows
        ]

        # Top Products
        top_prod_query = (
            db.query(
                Product.id,
                Product.sku,
                Product.designation,
                Category.name.label("cat_name"),
                func.coalesce(func.sum(SaleItem.quantity), 0.0).label("tot_qty"),
                func.coalesce(func.sum(SaleItem.line_subtotal_ht), 0.0).label("tot_ht"),
            )
            .join(SaleItem, SaleItem.product_id == Product.id)
            .join(Sale, Sale.id == SaleItem.sale_id)
            .outerjoin(Category, Category.id == Product.category_id)
            .filter(Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]))
        )
        if date_from:
            top_prod_query = top_prod_query.filter(Sale.order_date >= date_from)
        if date_to:
            top_prod_query = top_prod_query.filter(Sale.order_date <= date_to)
        top_prod_rows = (
            top_prod_query.group_by(Product.id, Product.sku, Product.designation, Category.name)
            .order_by(text("tot_ht DESC"))
            .limit(10)
            .all()
        )

        top_products = [
            TopProductReport(
                product_id=r[0],
                sku=r[1],
                designation=r[2],
                category_name=r[3],
                total_quantity=round(float(r[4]), 2),
                total_ht=round(float(r[5]), 2),
            )
            for r in top_prod_rows
        ]

        # Monthly Trends (last 12 months)
        monthly_trend = []
        for i in range(11, -1, -1):
            m_year = now.year
            m_month = now.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1

            m_start = datetime(m_year, m_month, 1, tzinfo=timezone.utc)
            m_end = datetime(m_year + 1, 1, 1, tzinfo=timezone.utc) if m_month == 12 else datetime(m_year, m_month + 1, 1, tzinfo=timezone.utc)
            m_label = f"{m_month:02d}/{m_year}"

            # Sales
            s_ht = (
                db.query(func.coalesce(func.sum(Sale.subtotal_ht), 0.0))
                .filter(
                    Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]),
                    Sale.order_date >= m_start,
                    Sale.order_date < m_end,
                )
                .scalar()
                or 0.0
            )

            s_ttc = (
                db.query(func.coalesce(func.sum(Sale.total_ttc), 0.0))
                .filter(
                    Sale.status.in_([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED, SaleStatus.DELIVERED]),
                    Sale.order_date >= m_start,
                    Sale.order_date < m_end,
                )
                .scalar()
                or 0.0
            )

            # Purchases
            p_ht = (
                db.query(func.coalesce(func.sum(PurchaseOrder.subtotal_ht), 0.0))
                .filter(
                    PurchaseOrder.status.in_([PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED]),
                    PurchaseOrder.order_date >= m_start,
                    PurchaseOrder.order_date < m_end,
                )
                .scalar()
                or 0.0
            )

            # Expenses
            e_ht = (
                db.query(func.coalesce(func.sum(Expense.amount), 0.0))
                .filter(
                    Expense.status != ExpenseStatus.CANCELLED,
                    Expense.expense_date >= m_start,
                    Expense.expense_date < m_end,
                )
                .scalar()
                or 0.0
            )

            margin = float(s_ht) - float(p_ht) - float(e_ht)

            monthly_trend.append(
                MonthlyTrendMarginItem(
                    period=m_label,
                    sales_ht=round(float(s_ht), 2),
                    sales_ttc=round(float(s_ttc), 2),
                    purchases_ht=round(float(p_ht), 2),
                    expenses_ht=round(float(e_ht), 2),
                    margin_ht=round(float(margin), 2),
                )
            )

        return CommercialReportResponse(
            period_start=date_from.strftime("%Y-%m-%d") if date_from else None,
            period_end=date_to.strftime("%Y-%m-%d") if date_to else None,
            total_turnover_ht=stats.sales_total_ht,
            total_turnover_ttc=stats.sales_total_ttc,
            total_collected_ttc=stats.total_paid,
            total_outstanding_due=stats.total_due,
            total_sales_count=stats.sales_total,
            total_invoices_count=stats.invoices_total,
            total_credit_notes_amount_ttc=stats.credit_notes_amount,
            top_customers=top_customers,
            top_products=top_products,
            monthly_trend=monthly_trend,
        )

