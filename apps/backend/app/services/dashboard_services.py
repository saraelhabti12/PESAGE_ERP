from datetime import datetime, timezone
from typing import List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand_model import Brand
from app.models.category_model import Category
from app.models.credit_note_model import CreditNote, CreditNoteStatus
from app.models.delivery_note_model import DeliveryNote
from app.models.expense_model import Expense, ExpenseStatus
from app.models.invoice_model import Invoice, InvoiceStatus, InvoiceType
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.payment_model import Payment
from app.models.product_model import Product
from app.models.product_type_model import ProductType
from app.models.purchase_model import (
    PurchaseOrder,
    PurchaseOrderStatus,
    PurchaseReceipt,
)
from app.models.maintenance_model import Equipment, Intervention, InterventionPriority, InterventionStatus
from app.models.quote_model import Quote, QuoteStatus
from app.models.sale_model import Sale, SaleStatus
from app.models.stock_model import StockMovement
from app.models.unit_model import Unit
from app.models.user_model import User
from app.models.vehicle_model import FuelLog, Vehicle, VehicleMaintenance
from app.schemas.dashboard_schemas import (
    CatalogDashboardStats,
    DashboardStatsResponse,
    ExpensesDashboardStats,
    InvoicesDashboardStats,
    MaintenanceDashboardStats,
    PartnersDashboardStats,
    PaymentsDashboardStats,
    PurchasesDashboardStats,
    QuotesDashboardStats,
    RecentActivityItem,
    SalesDashboardStats,
    StockDashboardStats,
    VehiclesDashboardStats,
)
from app.services.stock_services import StockService


class DashboardService:
    @staticmethod
    def get_stats(db: Session) -> DashboardStatsResponse:
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)

        # 1. Catalog Statistics
        total_prods = db.query(func.count(Product.id)).scalar() or 0
        active_prods = db.query(func.count(Product.id)).filter(Product.is_active.is_(True)).scalar() or 0
        inactive_prods = total_prods - active_prods
        total_cats = db.query(func.count(Category.id)).scalar() or 0
        total_types = db.query(func.count(ProductType.id)).scalar() or 0
        total_brands = db.query(func.count(Brand.id)).scalar() or 0
        total_units = db.query(func.count(Unit.id)).scalar() or 0

        catalog_stats = CatalogDashboardStats(
            total_products=total_prods,
            active_products=active_prods,
            inactive_products=inactive_prods,
            total_categories=total_cats,
            total_product_types=total_types,
            total_brands=total_brands,
            total_units=total_units,
        )

        # 2. Partners Statistics
        total_custs = (
            db.query(func.count(BusinessPartner.id))
            .filter(BusinessPartner.partner_type.in_([PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER]))
            .scalar()
            or 0
        )
        active_custs = (
            db.query(func.count(BusinessPartner.id))
            .filter(
                BusinessPartner.partner_type.in_([PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER]),
                BusinessPartner.is_active.is_(True),
            )
            .scalar()
            or 0
        )
        total_supps = (
            db.query(func.count(BusinessPartner.id))
            .filter(BusinessPartner.partner_type.in_([PartnerType.SUPPLIER, PartnerType.CUSTOMER_SUPPLIER]))
            .scalar()
            or 0
        )
        active_supps = (
            db.query(func.count(BusinessPartner.id))
            .filter(
                BusinessPartner.partner_type.in_([PartnerType.SUPPLIER, PartnerType.CUSTOMER_SUPPLIER]),
                BusinessPartner.is_active.is_(True),
            )
            .scalar()
            or 0
        )

        partners_stats = PartnersDashboardStats(
            total_customers=total_custs,
            active_customers=active_custs,
            total_suppliers=total_supps,
            active_suppliers=active_supps,
        )

        # 3. Purchases Statistics
        total_orders = db.query(func.count(PurchaseOrder.id)).scalar() or 0
        draft_orders = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == PurchaseOrderStatus.DRAFT).scalar() or 0
        pending_orders = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == PurchaseOrderStatus.PENDING).scalar() or 0
        approved_orders = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == PurchaseOrderStatus.APPROVED).scalar() or 0
        partial_orders = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == PurchaseOrderStatus.PARTIALLY_RECEIVED).scalar() or 0
        received_orders = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == PurchaseOrderStatus.RECEIVED).scalar() or 0

        financial_query = (
            db.query(
                func.coalesce(func.sum(PurchaseOrder.subtotal_ht), 0.0),
                func.coalesce(func.sum(PurchaseOrder.tax_amount), 0.0),
                func.coalesce(func.sum(PurchaseOrder.total_ttc), 0.0),
            )
            .filter(PurchaseOrder.status != PurchaseOrderStatus.CANCELLED)
            .first()
        )
        subtotal_ht, tax_amount, total_ttc = financial_query if financial_query else (0.0, 0.0, 0.0)

        supp_due = db.query(func.coalesce(func.sum(Invoice.amount_due), 0.0)).filter(
            Invoice.invoice_type == InvoiceType.SUPPLIER,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).scalar() or 0.0

        purchases_stats = PurchasesDashboardStats(
            total_orders=total_orders,
            draft_orders=draft_orders,
            pending_orders=pending_orders,
            approved_orders=approved_orders,
            partially_received_orders=partial_orders,
            received_orders=received_orders,
            total_subtotal_ht=round(float(subtotal_ht), 2),
            total_tax_amount=round(float(tax_amount), 2),
            total_ttc=round(float(total_ttc), 2),
            supplier_invoices_due=round(float(supp_due), 2),
        )

        # 4. Sales Statistics
        total_sales = db.query(func.count(Sale.id)).scalar() or 0
        draft_sales = db.query(func.count(Sale.id)).filter(Sale.status == SaleStatus.DRAFT).scalar() or 0
        confirmed_sales = db.query(func.count(Sale.id)).filter(Sale.status == SaleStatus.CONFIRMED).scalar() or 0
        cancelled_sales = db.query(func.count(Sale.id)).filter(Sale.status == SaleStatus.CANCELLED).scalar() or 0

        sales_fin_query = (
            db.query(
                func.coalesce(func.sum(Sale.subtotal_ht), 0.0),
                func.coalesce(func.sum(Sale.tax_amount), 0.0),
                func.coalesce(func.sum(Sale.total_ttc), 0.0),
            )
            .filter(Sale.status != SaleStatus.CANCELLED)
            .first()
        )
        sale_subtotal_ht, sale_tax_amount, sale_total_ttc = sales_fin_query if sales_fin_query else (0.0, 0.0, 0.0)

        sales_stats = SalesDashboardStats(
            total_orders=total_sales,
            draft_orders=draft_sales,
            confirmed_orders=confirmed_sales,
            cancelled_orders=cancelled_sales,
            total_subtotal_ht=round(float(sale_subtotal_ht), 2),
            total_tax_amount=round(float(sale_tax_amount), 2),
            total_ttc=round(float(sale_total_ttc), 2),
        )

        # 5. Quotes Statistics
        total_quotes = db.query(func.count(Quote.id)).scalar() or 0
        draft_quotes = db.query(func.count(Quote.id)).filter(Quote.status == QuoteStatus.DRAFT).scalar() or 0
        sent_quotes = db.query(func.count(Quote.id)).filter(Quote.status == QuoteStatus.SENT).scalar() or 0
        accepted_quotes = db.query(func.count(Quote.id)).filter(Quote.status == QuoteStatus.ACCEPTED).scalar() or 0
        rejected_quotes = db.query(func.count(Quote.id)).filter(Quote.status == QuoteStatus.REJECTED).scalar() or 0
        expired_quotes = db.query(func.count(Quote.id)).filter(Quote.status == QuoteStatus.EXPIRED).scalar() or 0

        quotes_fin_query = (
            db.query(func.coalesce(func.sum(Quote.total_ttc), 0.0))
            .filter(Quote.status.in_([QuoteStatus.SENT, QuoteStatus.ACCEPTED]))
            .scalar()
            or 0.0
        )

        quotes_stats = QuotesDashboardStats(
            total_quotes=total_quotes,
            draft_quotes=draft_quotes,
            sent_quotes=sent_quotes,
            accepted_quotes=accepted_quotes,
            rejected_quotes=rejected_quotes,
            expired_quotes=expired_quotes,
            total_ttc=round(float(quotes_fin_query), 2),
        )

        # 6. Invoices Statistics (Customer)
        total_invoices = db.query(func.count(Invoice.id)).filter(Invoice.invoice_type == InvoiceType.CUSTOMER).scalar() or 0
        draft_invoices = db.query(func.count(Invoice.id)).filter(Invoice.invoice_type == InvoiceType.CUSTOMER, Invoice.status == InvoiceStatus.DRAFT).scalar() or 0
        issued_invoices = db.query(func.count(Invoice.id)).filter(Invoice.invoice_type == InvoiceType.CUSTOMER, Invoice.status == InvoiceStatus.ISSUED).scalar() or 0
        partially_paid_invoices = db.query(func.count(Invoice.id)).filter(Invoice.invoice_type == InvoiceType.CUSTOMER, Invoice.status == InvoiceStatus.PARTIALLY_PAID).scalar() or 0
        paid_invoices = db.query(func.count(Invoice.id)).filter(Invoice.invoice_type == InvoiceType.CUSTOMER, Invoice.status == InvoiceStatus.PAID).scalar() or 0
        overdue_invoices = db.query(func.count(Invoice.id)).filter(Invoice.invoice_type == InvoiceType.CUSTOMER, Invoice.status == InvoiceStatus.OVERDUE).scalar() or 0

        inv_fin_query = (
            db.query(
                func.coalesce(func.sum(Invoice.total_ttc), 0.0),
                func.coalesce(func.sum(Invoice.amount_paid), 0.0),
                func.coalesce(func.sum(Invoice.amount_due), 0.0),
            )
            .filter(Invoice.invoice_type == InvoiceType.CUSTOMER, Invoice.status != InvoiceStatus.CANCELLED)
            .first()
        )
        inv_tot_ttc, inv_tot_paid, inv_tot_due = inv_fin_query if inv_fin_query else (0.0, 0.0, 0.0)

        # Credit Notes
        cn_count = db.query(func.count(CreditNote.id)).filter(CreditNote.status == CreditNoteStatus.ISSUED).scalar() or 0
        cn_sum = db.query(func.coalesce(func.sum(CreditNote.total_ttc), 0.0)).filter(CreditNote.status == CreditNoteStatus.ISSUED).scalar() or 0.0

        # Supplier Invoices & Payments
        supp_inv_q = (
            db.query(
                func.count(Invoice.id),
                func.coalesce(func.sum(Invoice.total_ttc), 0.0),
                func.coalesce(func.sum(Invoice.amount_paid), 0.0),
                func.coalesce(func.sum(Invoice.amount_due), 0.0),
            )
            .filter(Invoice.invoice_type == InvoiceType.SUPPLIER, Invoice.status != InvoiceStatus.CANCELLED)
            .first()
        )
        supp_tot_inv = supp_inv_q[0] if supp_inv_q else 0
        supp_tot_ttc = supp_inv_q[1] if supp_inv_q else 0.0
        supp_tot_paid = supp_inv_q[2] if supp_inv_q else 0.0
        supp_tot_due = supp_inv_q[3] if supp_inv_q else 0.0

        # Month Collections (Payments on customer invoices in current month)
        month_collected = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
            Payment.payment_date >= start_of_month
        ).scalar() or 0.0

        # Supplier payments
        supp_payments_q = (
            db.query(
                func.count(Payment.id),
                func.coalesce(func.sum(Payment.amount), 0.0),
            )
            .join(Payment.invoice)
            .filter(Invoice.invoice_type == InvoiceType.SUPPLIER)
            .first()
        )
        supp_payments_count = supp_payments_q[0] if supp_payments_q else 0
        supp_payments_amount = supp_payments_q[1] if supp_payments_q else 0.0

        invoices_stats = InvoicesDashboardStats(
            total_invoices=total_invoices,
            draft_invoices=draft_invoices,
            issued_invoices=issued_invoices,
            partially_paid_invoices=partially_paid_invoices,
            paid_invoices=paid_invoices,
            overdue_invoices=overdue_invoices,
            total_invoiced_ttc=round(float(inv_tot_ttc), 2),
            total_amount_paid=round(float(inv_tot_paid), 2),
            total_amount_due=round(float(inv_tot_due), 2),
            credit_notes_total=cn_count,
            credit_notes_amount=round(float(cn_sum), 2),
            supplier_invoices_total=supp_tot_inv,
            supplier_invoiced_ttc=round(float(supp_tot_ttc), 2),
            supplier_amount_paid=round(float(supp_tot_paid), 2),
            supplier_amount_due=round(float(supp_tot_due), 2),
            month_collected_amount=round(float(month_collected), 2),
            supplier_payments_count=supp_payments_count,
            supplier_payments_amount=round(float(supp_payments_amount), 2),
        )

        # 7. Payments Statistics
        total_payments = db.query(func.count(Payment.id)).scalar() or 0
        total_collected = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).scalar() or 0.0

        payments_stats = PaymentsDashboardStats(
            total_payments=total_payments,
            total_collected_amount=round(float(total_collected), 2),
        )

        # 8. Stock Statistics
        stock_stats_dict = StockService.get_stock_stats(db)
        stock_stats = StockDashboardStats(
            managed_products=stock_stats_dict["managed_products"],
            total_quantity=stock_stats_dict["total_quantity"],
            total_value_ht=stock_stats_dict["total_value_ht"],
            low_stock=stock_stats_dict["low_stock"],
            out_of_stock=stock_stats_dict["out_of_stock"],
            overstock=stock_stats_dict["overstock"],
            active_warehouses=stock_stats_dict["active_warehouses"],
            movement_count=stock_stats_dict["movement_count"],
        )

        # 9. Expenses Statistics
        exp_total = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED
        ).scalar() or 0.0

        exp_month = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.expense_date >= start_of_month,
        ).scalar() or 0.0

        exp_year = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.expense_date >= start_of_year,
        ).scalar() or 0.0

        exp_fixed = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.recurring_expense_id.isnot(None),
            Expense.expense_date >= start_of_month,
        ).scalar() or 0.0

        exp_var = float(exp_month) - float(exp_fixed)

        expenses_stats = ExpensesDashboardStats(
            total_expenses=round(float(exp_total), 2),
            this_month=round(float(exp_month), 2),
            this_year=round(float(exp_year), 2),
            fixed_expenses=round(float(exp_fixed), 2),
            variable_expenses=round(max(0.0, float(exp_var)), 2),
        )

        # 10. Vehicles Statistics
        v_total = db.query(func.count(Vehicle.id)).scalar() or 0
        v_maint_m = db.query(func.coalesce(func.sum(VehicleMaintenance.total_cost), 0.0)).filter(
            VehicleMaintenance.maintenance_date >= start_of_month
        ).scalar() or 0.0
        v_fuel_m = db.query(func.coalesce(func.sum(FuelLog.total_cost), 0.0)).filter(
            FuelLog.date >= start_of_month
        ).scalar() or 0.0

        vehicles_stats = VehiclesDashboardStats(
            total_vehicles=v_total,
            fuel_cost_month=round(float(v_fuel_m), 2),
            maintenance_cost_month=round(float(v_maint_m), 2),
            total_expenses_month=round(float(v_maint_m) + float(v_fuel_m), 2),
        )

        # 11. Recent Activities
        recent_activity: List[RecentActivityItem] = []

        # Recent Payments
        recent_payments = db.query(Payment).order_by(Payment.created_at.desc()).limit(5).all()
        for p in recent_payments:
            user_display = (f"{p.creator.first_name or ''} {p.creator.last_name or ''}".strip() or p.creator.email) if p.creator else None
            recent_activity.append(
                RecentActivityItem(
                    id=f"payment_{p.id}",
                    type="payment",
                    title=f"Règlement reçu {p.reference} ({p.amount:.2f} DH)",
                    reference=p.reference,
                    user_name=user_display,
                    status=p.payment_method,
                    created_at=p.created_at,
                )
            )

        # Recent Invoices
        recent_invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).limit(5).all()
        for inv in recent_invoices:
            user_display = (f"{inv.creator.first_name or ''} {inv.creator.last_name or ''}".strip() or inv.creator.email) if inv.creator else None
            recent_activity.append(
                RecentActivityItem(
                    id=f"inv_{inv.id}",
                    type="invoice",
                    title=f"Facture {'client' if inv.invoice_type == InvoiceType.CUSTOMER else 'fournisseur'} {inv.reference}",
                    reference=inv.reference,
                    user_name=user_display,
                    status=inv.status.value,
                    created_at=inv.created_at,
                )
            )

        # Recent Credit Notes
        recent_cns = db.query(CreditNote).order_by(CreditNote.created_at.desc()).limit(3).all()
        for cn in recent_cns:
            user_display = (f"{cn.creator.first_name or ''} {cn.creator.last_name or ''}".strip() or cn.creator.email) if cn.creator else None
            recent_activity.append(
                RecentActivityItem(
                    id=f"cn_{cn.id}",
                    type="credit_note",
                    title=f"Avoir client {cn.reference} ({cn.total_ttc:.2f} DH)",
                    reference=cn.reference,
                    user_name=user_display,
                    status=cn.status.value,
                    created_at=cn.created_at,
                )
            )

        # Recent Delivery Notes
        recent_dns = db.query(DeliveryNote).order_by(DeliveryNote.created_at.desc()).limit(5).all()
        for dn in recent_dns:
            user_display = (f"{dn.creator.first_name or ''} {dn.creator.last_name or ''}".strip() or dn.creator.email) if dn.creator else None
            recent_activity.append(
                RecentActivityItem(
                    id=f"dn_{dn.id}",
                    type="delivery_note",
                    title=f"Bon de livraison {dn.reference}",
                    reference=dn.reference,
                    user_name=user_display,
                    status=dn.status.value,
                    created_at=dn.created_at,
                )
            )

        # Recent Sales
        recent_sales = db.query(Sale).order_by(Sale.created_at.desc()).limit(5).all()
        for s in recent_sales:
            user_display = (f"{s.creator.first_name or ''} {s.creator.last_name or ''}".strip() or s.creator.email) if s.creator else None
            recent_activity.append(
                RecentActivityItem(
                    id=f"sale_{s.id}",
                    type="sale",
                    title=f"Vente client {s.reference}",
                    reference=s.reference,
                    user_name=user_display,
                    status=s.status.value,
                    created_at=s.created_at,
                )
            )

        # Recent Purchases
        recent_pos = db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(5).all()
        for po in recent_pos:
            user_display = (f"{po.creator.first_name or ''} {po.creator.last_name or ''}".strip() or po.creator.email) if po.creator else None
            recent_activity.append(
                RecentActivityItem(
                    id=f"po_{po.id}",
                    type="purchase_order",
                    title=f"Commande d'achat {po.reference}",
                    reference=po.reference,
                    user_name=user_display,
                    status=po.status.value,
                    created_at=po.created_at,
                )
            )

        recent_activity.sort(key=lambda x: x.created_at, reverse=True)
        recent_activity = recent_activity[:10]

        # 11. Maintenance & Interventions Statistics
        total_interventions = db.query(func.count(Intervention.id)).scalar() or 0
        month_interventions = db.query(func.count(Intervention.id)).filter(
            Intervention.date_start >= start_of_month
        ).scalar() or 0
        in_progress_interventions = db.query(func.count(Intervention.id)).filter(
            Intervention.status == InterventionStatus.IN_PROGRESS
        ).scalar() or 0
        completed_interventions = db.query(func.count(Intervention.id)).filter(
            Intervention.status == InterventionStatus.COMPLETED
        ).scalar() or 0
        urgent_interventions = db.query(func.count(Intervention.id)).filter(
            Intervention.priority.in_([InterventionPriority.HIGH, InterventionPriority.CRITICAL])
        ).scalar() or 0
        total_equipments = db.query(func.count(Equipment.id)).scalar() or 0
        now_dt = datetime.now(timezone.utc)
        upcoming_maintenances = db.query(func.count(Intervention.id)).filter(
            Intervention.next_maintenance_date >= now_dt
        ).scalar() or 0
        maint_cost_month = db.query(func.coalesce(func.sum(Intervention.total_cost), 0.0)).filter(
            Intervention.date_start >= start_of_month
        ).scalar() or 0.0
        maint_cost_year = db.query(func.coalesce(func.sum(Intervention.total_cost), 0.0)).filter(
            Intervention.date_start >= start_of_year
        ).scalar() or 0.0

        maintenance_stats = MaintenanceDashboardStats(
            total_interventions=total_interventions,
            month_interventions=month_interventions,
            in_progress_interventions=in_progress_interventions,
            completed_interventions=completed_interventions,
            urgent_interventions=urgent_interventions,
            total_equipments=total_equipments,
            upcoming_maintenances=upcoming_maintenances,
            maintenance_cost_month=round(float(maint_cost_month), 2),
            maintenance_cost_year=round(float(maint_cost_year), 2),
        )

        return DashboardStatsResponse(
            catalog=catalog_stats,
            partners=partners_stats,
            purchases=purchases_stats,
            sales=sales_stats,
            quotes=quotes_stats,
            invoices=invoices_stats,
            payments=payments_stats,
            stock=stock_stats,
            expenses=expenses_stats,
            vehicles=vehicles_stats,
            maintenance=maintenance_stats,
            recent_activity=recent_activity,
        )
