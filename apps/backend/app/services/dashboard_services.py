from datetime import datetime
from typing import List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand_model import Brand
from app.models.category_model import Category
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.product_model import Product
from app.models.product_type_model import ProductType
from app.models.purchase_model import (
    PurchaseOrder,
    PurchaseOrderStatus,
    PurchaseReceipt,
)
from app.models.unit_model import Unit
from app.models.user_model import User
from app.schemas.dashboard_schemas import (
    CatalogDashboardStats,
    DashboardStatsResponse,
    PartnersDashboardStats,
    PurchasesDashboardStats,
    RecentActivityItem,
)


class DashboardService:
    @staticmethod
    def get_stats(db: Session) -> DashboardStatsResponse:
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

        # Financial Aggregates (all non-cancelled orders)
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
        )

        # 4. Recent Activities from Real Records
        recent_activity: List[RecentActivityItem] = []

        # Recent Purchase Orders
        recent_pos = db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(5).all()
        for po in recent_pos:
            recent_activity.append(
                RecentActivityItem(
                    id=f"po_{po.id}",
                    type="purchase_order",
                    title=f"Commande d'achat {po.reference}",
                    reference=po.reference,
                    user_name=f"{po.creator.first_name} {po.creator.last_name}" if po.creator else None,
                    status=po.status.value,
                    created_at=po.created_at,
                )
            )

        # Recent Products
        recent_products = db.query(Product).order_by(Product.created_at.desc()).limit(5).all()
        for p in recent_products:
            recent_activity.append(
                RecentActivityItem(
                    id=f"prod_{p.id}",
                    type="product",
                    title=f"Produit ajouté : {p.designation}",
                    reference=p.sku,
                    user_name=None,
                    status="Actif" if p.is_active else "Inactif",
                    created_at=p.created_at,
                )
            )

        # Recent Partners
        recent_partners = db.query(BusinessPartner).order_by(BusinessPartner.created_at.desc()).limit(5).all()
        for bp in recent_partners:
            partner_label = "Client" if bp.partner_type == PartnerType.CUSTOMER else ("Fournisseur" if bp.partner_type == PartnerType.SUPPLIER else "Client & Fournisseur")
            recent_activity.append(
                RecentActivityItem(
                    id=f"partner_{bp.id}",
                    type="partner",
                    title=f"{partner_label} créé : {bp.legal_name}",
                    reference=bp.code,
                    user_name=None,
                    status="Actif" if bp.is_active else "Inactif",
                    created_at=bp.created_at,
                )
            )

        # Sort all recent activity by created_at descending and take top 10
        recent_activity.sort(key=lambda x: x.created_at, reverse=True)
        recent_activity = recent_activity[:10]

        return DashboardStatsResponse(
            catalog=catalog_stats,
            partners=partners_stats,
            purchases=purchases_stats,
            recent_activity=recent_activity,
        )
