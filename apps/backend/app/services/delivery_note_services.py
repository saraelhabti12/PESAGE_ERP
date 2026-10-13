from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.delivery_note_model import DeliveryNote, DeliveryNoteItem, DeliveryNoteStatus
from app.models.notification_model import NotificationType
from app.models.partner_model import BusinessPartner
from app.models.product_model import Product
from app.models.sale_model import Sale, SaleItem, SaleStatus
from app.schemas.delivery_note_schemas import (
    DeliveryNoteCreate,
    DeliveryProgressItem,
    SaleDeliveryProgressResponse,
)
from app.services.notification_services import NotificationService


class DeliveryNoteService:
    @staticmethod
    def generate_delivery_reference(db: Session) -> str:
        """Generates a sequential delivery note reference like BL-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"BL-{now.strftime('%Y%m')}-"
        count = db.query(func.count(DeliveryNote.id)).filter(DeliveryNote.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def get_sale_delivery_progress(cls, db: Session, sale_id: int) -> Dict[int, Dict[str, float]]:
        """Returns a dict keyed by product_id with ordered, already_delivered, and remaining quantities for a sale."""
        sale = (
            db.query(Sale)
            .options(selectinload(Sale.items))
            .filter(Sale.id == sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        progress: Dict[int, Dict[str, float]] = {}
        for s_item in sale.items:
            progress[s_item.product_id] = {
                "ordered": float(s_item.quantity),
                "delivered": 0.0,
                "remaining": float(s_item.quantity),
            }

        existing_dns = (
            db.query(DeliveryNote)
            .options(selectinload(DeliveryNote.items))
            .filter(
                DeliveryNote.sale_id == sale_id,
                DeliveryNote.status != DeliveryNoteStatus.CANCELLED,
            )
            .all()
        )

        for dn in existing_dns:
            for item in dn.items:
                if item.product_id in progress:
                    progress[item.product_id]["delivered"] += float(item.delivered_quantity)
                    progress[item.product_id]["remaining"] = max(
                        0.0,
                        progress[item.product_id]["ordered"] - progress[item.product_id]["delivered"]
                    )

        return progress

    @classmethod
    def get_sale_delivery_progress_detailed(cls, db: Session, sale_id: int) -> SaleDeliveryProgressResponse:
        """Returns structured progress details for each sale item including SKU, name, depot, and quantities."""
        sale = (
            db.query(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.warehouse),
                selectinload(Sale.customer),
            )
            .filter(Sale.id == sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        progress_dict = cls.get_sale_delivery_progress(db, sale.id)

        # Track allocated delivered count per product across sale lines
        delivered_allocated_by_product = {p_id: 0.0 for p_id in progress_dict.keys()}

        items_progress: List[DeliveryProgressItem] = []
        for s_item in sale.items:
            p_id = s_item.product_id
            p_info = progress_dict.get(
                p_id,
                {"ordered": float(s_item.quantity), "delivered": 0.0, "remaining": float(s_item.quantity)},
            )
            total_delivered = p_info["delivered"]

            remaining_to_allocate = max(0.0, total_delivered - delivered_allocated_by_product.get(p_id, 0.0))
            item_ordered = float(s_item.quantity)
            item_delivered = min(item_ordered, remaining_to_allocate)
            delivered_allocated_by_product[p_id] = delivered_allocated_by_product.get(p_id, 0.0) + item_delivered
            item_remaining = max(0.0, round(item_ordered - item_delivered, 2))

            p_name = s_item.product.designation if s_item.product else f"Produit #{p_id}"
            p_sku = s_item.product.sku if s_item.product else ""
            wh_name = s_item.warehouse.name if s_item.warehouse else None

            items_progress.append(
                DeliveryProgressItem(
                    sale_item_id=s_item.id,
                    product_id=p_id,
                    product_name=p_name,
                    product_sku=p_sku,
                    warehouse_id=s_item.warehouse_id,
                    warehouse_name=wh_name,
                    ordered_quantity=item_ordered,
                    delivered_quantity=item_delivered,
                    remaining_quantity=item_remaining,
                )
            )

        return SaleDeliveryProgressResponse(
            sale_id=sale.id,
            sale_reference=sale.reference,
            sale_status=sale.status.value,
            items=items_progress,
        )

    @classmethod
    def create_delivery_note(cls, db: Session, data: DeliveryNoteCreate, user_id: int) -> DeliveryNote:
        # 1. Validate Sale
        sale = (
            db.query(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.warehouse),
                selectinload(Sale.customer),
            )
            .filter(Sale.id == data.sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        if sale.status not in (SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_DELIVERED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La livraison ne peut être créée que pour des ventes confirmées ou partiellement livrées (Statut actuel: '{sale.status.value}').",
            )

        # 2. Check delivery progress for the sale
        progress = cls.get_sale_delivery_progress(db, sale.id)

        # 3. Generate reference
        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_delivery_reference(db)
        existing = db.query(DeliveryNote).filter(DeliveryNote.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un bon de livraison avec la référence '{reference}' existe déjà.",
            )

        delivery_date = data.delivery_date or datetime.now(timezone.utc)
        customer_id = data.customer_id or sale.customer_id
        delivery_address = data.delivery_address or data.shipping_address or (sale.customer.address if sale.customer else None)

        final_notes = data.notes
        if data.tracking_number and data.tracking_number.strip():
            tracking_tag = f"[Suivi: {data.tracking_number.strip()}]"
            if final_notes and final_notes.strip():
                if tracking_tag not in final_notes:
                    final_notes = f"{tracking_tag} {final_notes.strip()}"
            else:
                final_notes = tracking_tag

        delivery_note = DeliveryNote(
            reference=reference,
            sale_id=sale.id,
            customer_id=customer_id,
            delivery_date=delivery_date,
            delivery_address=delivery_address,
            status=DeliveryNoteStatus.DELIVERED,
            notes=final_notes,
            created_by=user_id,
        )

        for item_data in data.items:
            # Resolve product and warehouse from either sale_item_id or product_id
            if item_data.sale_item_id:
                matching_sale_item = next((si for si in sale.items if si.id == item_data.sale_item_id), None)
                if not matching_sale_item:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ligne de commande #{item_data.sale_item_id} introuvable dans la vente {sale.reference}.",
                    )
                product = matching_sale_item.product
                wh_id = item_data.warehouse_id or matching_sale_item.warehouse_id
            elif item_data.product_id:
                product = db.query(Product).filter(Product.id == item_data.product_id).first()
                if not product:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Le produit avec l'ID {item_data.product_id} n'existe pas.",
                    )
                matching_sale_item = next((si for si in sale.items if si.product_id == product.id), None)
                wh_id = item_data.warehouse_id or (matching_sale_item.warehouse_id if matching_sale_item else None)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Chaque article doit spécifier au moins un 'sale_item_id' ou un 'product_id'.",
                )

            if product.id not in progress:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le produit '{product.designation}' ne fait pas partie de la commande {sale.reference}.",
                )

            deliv_qty = float(item_data.delivered_quantity)
            if deliv_qty <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La quantité livrée doit être strictement supérieure à 0.",
                )

            ordered_qty = progress[product.id]["ordered"]
            rem_before = progress[product.id]["remaining"]

            if deliv_qty > rem_before + 1e-4:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quantité livrée ({deliv_qty}) supérieure au reste à livrer ({rem_before}) pour le produit '{product.designation}'.",
                )

            rem_after = max(0.0, round(rem_before - deliv_qty, 2))
            progress[product.id]["delivered"] += deliv_qty
            progress[product.id]["remaining"] = rem_after

            dn_item = DeliveryNoteItem(
                product_id=product.id,
                warehouse_id=wh_id,
                ordered_quantity=ordered_qty,
                delivered_quantity=deliv_qty,
                remaining_quantity=rem_after,
            )
            delivery_note.items.append(dn_item)

        # 4. Check if entire sale is now fully delivered
        all_fully_delivered = True
        for p_id, p_info in progress.items():
            if p_info["remaining"] > 0.001:
                all_fully_delivered = False
                break

        if all_fully_delivered:
            sale.status = SaleStatus.DELIVERED
        else:
            sale.status = SaleStatus.PARTIALLY_DELIVERED

        sale.updated_at = datetime.now(timezone.utc)

        db.add(delivery_note)
        db.commit()
        db.refresh(delivery_note)

        # Notify
        NotificationService.create_notification(
            db=db,
            title="Bon de livraison créé",
            message=f"Le bon de livraison {delivery_note.reference} pour la vente {sale.reference} a été créé.",
            type=NotificationType.SUCCESS,
            user_id=user_id,
            link="/livraisons",
        )

        return delivery_note


    @classmethod
    def cancel_delivery_note(cls, db: Session, dn_id: int) -> DeliveryNote:
        dn = db.query(DeliveryNote).filter(DeliveryNote.id == dn_id).first()
        if not dn:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de livraison introuvable.")

        if dn.status == DeliveryNoteStatus.CANCELLED:
            return dn

        dn.status = DeliveryNoteStatus.CANCELLED
        dn.updated_at = datetime.now(timezone.utc)

        # Recalculate sale status
        sale = db.query(Sale).filter(Sale.id == dn.sale_id).first()
        if sale:
            progress = cls.get_sale_delivery_progress(db, sale.id)
            total_delivered = sum(p["delivered"] for p in progress.values())
            all_remaining = sum(p["remaining"] for p in progress.values())

            if total_delivered <= 0:
                sale.status = SaleStatus.CONFIRMED
            elif all_remaining <= 0.001:
                sale.status = SaleStatus.DELIVERED
            else:
                sale.status = SaleStatus.PARTIALLY_DELIVERED
            sale.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(dn)
        return dn

    @staticmethod
    def get_delivery_note(db: Session, dn_id: int) -> DeliveryNote:
        dn = (
            db.query(DeliveryNote)
            .options(
                selectinload(DeliveryNote.items).selectinload(DeliveryNoteItem.product),
                selectinload(DeliveryNote.items).selectinload(DeliveryNoteItem.warehouse),
                selectinload(DeliveryNote.sale),
                selectinload(DeliveryNote.customer),
                selectinload(DeliveryNote.creator),
            )
            .filter(DeliveryNote.id == dn_id)
            .first()
        )
        if not dn:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de livraison introuvable.")
        return dn

    @staticmethod
    def list_delivery_notes(
        db: Session,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        sale_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[DeliveryNote], int]:
        query = (
            db.query(DeliveryNote)
            .join(DeliveryNote.customer)
            .join(DeliveryNote.sale)
            .options(
                selectinload(DeliveryNote.items).selectinload(DeliveryNoteItem.product),
                selectinload(DeliveryNote.items).selectinload(DeliveryNoteItem.warehouse),
                selectinload(DeliveryNote.sale),
                selectinload(DeliveryNote.customer),
                selectinload(DeliveryNote.creator),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    DeliveryNote.reference.ilike(s),
                    Sale.reference.ilike(s),
                    BusinessPartner.legal_name.ilike(s),
                    BusinessPartner.trade_name.ilike(s),
                )
            )

        if customer_id:
            query = query.filter(DeliveryNote.customer_id == customer_id)

        if sale_id:
            query = query.filter(DeliveryNote.sale_id == sale_id)

        if status_filter and status_filter != "all":
            query = query.filter(DeliveryNote.status == status_filter)

        if date_from:
            query = query.filter(DeliveryNote.delivery_date >= date_from)

        if date_to:
            query = query.filter(DeliveryNote.delivery_date <= date_to)

        total = query.count()
        dns = query.order_by(DeliveryNote.delivery_date.desc(), DeliveryNote.id.desc()).offset(skip).limit(limit).all()
        return dns, total
