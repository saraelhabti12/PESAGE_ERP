from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.notification_model import NotificationType
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.product_model import Product
from app.models.purchase_model import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseReceiptStatus,
)
from app.schemas.purchase_schemas import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderUpdate,
    PurchaseReceiptCreate,
    PurchaseReceiptItemCreate,
)
from app.services.notification_services import NotificationService


class PurchaseService:
    @staticmethod
    def calculate_line_totals(
        quantity: float,
        unit_price_ht: float,
        tax_rate: float,
        discount_rate: float,
    ) -> Tuple[float, float, float]:
        """Calculates line subtotal HT, line tax, and line total TTC with exact decimal rounding."""
        gross = round(quantity * unit_price_ht, 2)
        discount = round(gross * (discount_rate / 100.0), 2)
        subtotal_ht = round(gross - discount, 2)
        tax = round(subtotal_ht * (tax_rate / 100.0), 2)
        total_ttc = round(subtotal_ht + tax, 2)
        return subtotal_ht, tax, total_ttc

    @staticmethod
    def generate_order_reference(db: Session) -> str:
        """Generates a sequential purchase order reference like PO-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"PO-{now.strftime('%Y%m')}-"
        count = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_purchase_order(cls, db: Session, data: PurchaseOrderCreate, user_id: int) -> PurchaseOrder:
        # 1. Validate Supplier
        supplier = db.query(BusinessPartner).filter(BusinessPartner.id == data.supplier_id).first()
        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le fournisseur avec l'ID {data.supplier_id} n'existe pas.",
            )
        if supplier.partner_type not in (PartnerType.SUPPLIER, PartnerType.CUSTOMER_SUPPLIER):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le partenaire '{supplier.legal_name}' n'est pas configuré comme fournisseur.",
            )
        if not supplier.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le fournisseur '{supplier.legal_name}' est inactif.",
            )

        # 2. Reference validation or generation
        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_order_reference(db)
        existing = db.query(PurchaseOrder).filter(PurchaseOrder.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Une commande d'achat avec la référence '{reference}' existe déjà.",
            )

        # 3. Validate and build line items
        order_date = data.order_date or datetime.now(timezone.utc)
        order = PurchaseOrder(
            reference=reference,
            supplier_id=supplier.id,
            order_date=order_date,
            expected_date=data.expected_date,
            status=PurchaseOrderStatus.DRAFT,
            payment_terms=data.payment_terms,
            payment_method=data.payment_method,
            notes=data.notes,
            created_by=user_id,
        )

        total_subtotal_ht = 0.0
        total_tax_amount = 0.0
        total_ttc = 0.0

        for item_data in data.items:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le produit avec l'ID {item_data.product_id} n'existe pas.",
                )
            if not product.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le produit '{product.designation}' est inactif.",
                )

            qty = float(item_data.quantity_ordered)
            price = float(item_data.unit_price_ht)
            tax_rate = float(item_data.tax_rate)
            discount_rate = float(item_data.discount_rate)

            if qty <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La quantité commandée doit être supérieure à 0.",
                )
            if price < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le prix unitaire HT ne peut pas être négatif.",
                )
            if tax_rate < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le taux de TVA ne peut pas être négatif.",
                )
            if discount_rate < 0 or discount_rate > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le taux de remise doit être compris entre 0 et 100 %.",
                )

            line_subtotal, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

            order_item = PurchaseOrderItem(
                product_id=product.id,
                quantity_ordered=qty,
                unit_price_ht=price,
                tax_rate=tax_rate,
                discount_rate=discount_rate,
                line_subtotal_ht=line_subtotal,
                line_tax=line_tax,
                line_total_ttc=line_ttc,
                quantity_received=0.00,
                quantity_remaining=qty,
            )
            order.items.append(order_item)

            total_subtotal_ht += line_subtotal
            total_tax_amount += line_tax
            total_ttc += line_ttc

        order.subtotal_ht = round(total_subtotal_ht, 2)
        order.tax_amount = round(total_tax_amount, 2)
        order.total_ttc = round(total_ttc, 2)

        db.add(order)
        db.commit()
        db.refresh(order)
        return order

    @classmethod
    def update_purchase_order(cls, db: Session, order_id: int, data: PurchaseOrderUpdate) -> PurchaseOrder:
        order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande d'achat introuvable.")

        if order.status not in (PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.PENDING):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Impossible de modifier une commande avec le statut '{order.status.value}'.",
            )

        if data.supplier_id is not None and data.supplier_id != order.supplier_id:
            supplier = db.query(BusinessPartner).filter(BusinessPartner.id == data.supplier_id).first()
            if not supplier:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fournisseur introuvable.")
            if supplier.partner_type not in (PartnerType.SUPPLIER, PartnerType.CUSTOMER_SUPPLIER):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le partenaire n'est pas un fournisseur.")
            order.supplier_id = supplier.id

        if data.order_date is not None:
            order.order_date = data.order_date
        if data.expected_date is not None:
            order.expected_date = data.expected_date
        if data.payment_terms is not None:
            order.payment_terms = data.payment_terms
        if data.payment_method is not None:
            order.payment_method = data.payment_method
        if data.notes is not None:
            order.notes = data.notes

        if data.items is not None:
            # Rebuild line items
            order.items.clear()
            total_subtotal_ht = 0.0
            total_tax_amount = 0.0
            total_ttc = 0.0

            for item_data in data.items:
                product = db.query(Product).filter(Product.id == item_data.product_id).first()
                if not product or not product.is_active:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Produit invalide ou inactif.")

                qty = float(item_data.quantity_ordered)
                price = float(item_data.unit_price_ht)
                tax_rate = float(item_data.tax_rate)
                discount_rate = float(item_data.discount_rate)

                if qty <= 0:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantité invalide.")
                if price < 0 or tax_rate < 0 or discount_rate < 0 or discount_rate > 100:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valeurs tarifaires invalides.")

                line_subtotal, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

                order_item = PurchaseOrderItem(
                    product_id=product.id,
                    quantity_ordered=qty,
                    unit_price_ht=price,
                    tax_rate=tax_rate,
                    discount_rate=discount_rate,
                    line_subtotal_ht=line_subtotal,
                    line_tax=line_tax,
                    line_total_ttc=line_ttc,
                    quantity_received=0.00,
                    quantity_remaining=qty,
                )
                order.items.append(order_item)

                total_subtotal_ht += line_subtotal
                total_tax_amount += line_tax
                total_ttc += line_ttc

            order.subtotal_ht = round(total_subtotal_ht, 2)
            order.tax_amount = round(total_tax_amount, 2)
            order.total_ttc = round(total_ttc, 2)

        order.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def approve_purchase_order(db: Session, order_id: int, user_id: int) -> PurchaseOrder:
        order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande d'achat introuvable.")

        if order.status in (PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED):
            return order

        if order.status == PurchaseOrderStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d'approuver une commande déjà annulée.",
            )

        order.status = PurchaseOrderStatus.APPROVED
        order.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order)

        # Trigger notification
        NotificationService.create_notification(
            db=db,
            title="Commande d'achat validée",
            message=f"La commande {order.reference} a été approuvée avec succès.",
            type=NotificationType.SUCCESS,
            user_id=order.created_by,
            link=f"/achats",
        )

        return order

    @staticmethod
    def cancel_purchase_order(db: Session, order_id: int, user_id: int) -> PurchaseOrder:
        order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande d'achat introuvable.")

        if order.status == PurchaseOrderStatus.CANCELLED:
            return order

        # Cannot cancel if goods have already been received
        total_received = sum(item.quantity_received for item in order.items)
        if total_received > 0 or order.status in (PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d'annuler une commande ayant déjà fait l'objet de réceptions.",
            )

        order.status = PurchaseOrderStatus.CANCELLED
        order.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def delete_purchase_order(db: Session, order_id: int) -> None:
        order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande d'achat introuvable.")

        if order.status not in (PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seules les commandes au statut 'DRAFT' ou 'CANCELLED' peuvent être supprimées.",
            )

        db.delete(order)
        db.commit()

    @staticmethod
    def get_purchase_order(db: Session, order_id: int) -> PurchaseOrder:
        order = (
            db.query(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
                selectinload(PurchaseOrder.receipts).selectinload(PurchaseReceipt.items).selectinload(PurchaseReceiptItem.product),
                selectinload(PurchaseOrder.receipts).selectinload(PurchaseReceipt.receiver),
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.creator),
            )
            .filter(PurchaseOrder.id == order_id)
            .first()
        )
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande d'achat introuvable.")
        return order

    @staticmethod
    def list_purchase_orders(
        db: Session,
        search: Optional[str] = None,
        supplier_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[PurchaseOrder], int]:
        query = db.query(PurchaseOrder).join(PurchaseOrder.supplier)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                (PurchaseOrder.reference.ilike(s))
                | (BusinessPartner.legal_name.ilike(s))
                | (BusinessPartner.trade_name.ilike(s))
                | (BusinessPartner.code.ilike(s))
            )

        if supplier_id:
            query = query.filter(PurchaseOrder.supplier_id == supplier_id)

        if status_filter:
            query = query.filter(PurchaseOrder.status == status_filter)

        if start_date:
            query = query.filter(PurchaseOrder.order_date >= start_date)

        if end_date:
            query = query.filter(PurchaseOrder.order_date <= end_date)

        total = query.count()
        orders = query.order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc()).offset(skip).limit(limit).all()
        return orders, total


class PurchaseReceiptService:
    @staticmethod
    def generate_receipt_reference(db: Session) -> str:
        """Generates a sequential purchase receipt reference like REC-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"REC-{now.strftime('%Y%m')}-"
        count = db.query(func.count(PurchaseReceipt.id)).filter(PurchaseReceipt.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_receipt(cls, db: Session, data: PurchaseReceiptCreate, user_id: int) -> PurchaseReceipt:
        # 1. Validate Purchase Order
        order = db.query(PurchaseOrder).filter(PurchaseOrder.id == data.purchase_order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La commande d'achat avec l'ID {data.purchase_order_id} n'existe pas.",
            )

        if order.status not in (PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Impossible de réceptionner une commande au statut '{order.status.value}'. La commande doit être approuvée.",
            )

        # 2. Reference validation or generation
        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_receipt_reference(db)
        existing = db.query(PurchaseReceipt).filter(PurchaseReceipt.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un bon de réception avec la référence '{reference}' existe déjà.",
            )

        # 3. Create Receipt
        receipt_date = data.receipt_date or datetime.now(timezone.utc)
        receipt = PurchaseReceipt(
            reference=reference,
            purchase_order_id=order.id,
            receipt_date=receipt_date,
            status=PurchaseReceiptStatus.CONFIRMED,
            notes=data.notes,
            received_by=user_id,
        )

        # 4. Map existing order items by ID
        order_items_map = {item.id: item for item in order.items}

        for item_in in data.items:
            order_item = order_items_map.get(item_in.purchase_order_item_id)
            if not order_item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La ligne de commande {item_in.purchase_order_item_id} n'appartient pas à cette commande.",
                )

            if order_item.product_id != item_in.product_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le produit indiqué ne correspond pas à la ligne de commande.",
                )

            qty_received = float(item_in.quantity_received)
            if qty_received <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La quantité reçue doit être strictement supérieure à 0.",
                )

            current_remaining = float(order_item.quantity_remaining)
            if qty_received > current_remaining:
                product_name = order_item.product.designation if order_item.product else f"ID {order_item.product_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La quantité reçue ({qty_received}) dépasse le reste à recevoir ({current_remaining}) pour le produit '{product_name}'.",
                )

            # Update order item received & remaining counters
            order_item.quantity_received = round(float(order_item.quantity_received) + qty_received, 2)
            order_item.quantity_remaining = round(float(order_item.quantity_ordered) - float(order_item.quantity_received), 2)
            order_item.updated_at = datetime.now(timezone.utc)

            # Create receipt item
            receipt_item = PurchaseReceiptItem(
                purchase_order_item_id=order_item.id,
                product_id=order_item.product_id,
                warehouse_id=item_in.warehouse_id,
                quantity_received=qty_received,
                notes=item_in.notes,
            )
            receipt.items.append(receipt_item)

        # 5. Recalculate Purchase Order Status
        total_remaining = sum(float(item.quantity_remaining) for item in order.items)
        total_received = sum(float(item.quantity_received) for item in order.items)

        if total_remaining <= 0:
            order.status = PurchaseOrderStatus.RECEIVED
        elif total_received > 0:
            order.status = PurchaseOrderStatus.PARTIALLY_RECEIVED
        else:
            order.status = PurchaseOrderStatus.APPROVED

        order.updated_at = datetime.now(timezone.utc)

        db.add(receipt)
        db.flush()

        # Phase 7 Service Boundary: Update stock quantities & movements atomically
        from app.services.stock_services import StockService
        StockService.process_purchase_receipt(db, receipt, user_id=user_id)

        db.commit()
        db.refresh(receipt)

        # Trigger notification
        NotificationService.create_notification(
            db=db,
            title="Réception de marchandises enregistrée",
            message=f"Le bon de réception {receipt.reference} a été créé pour la commande {order.reference}.",
            type=NotificationType.INFO,
            user_id=order.created_by,
            link=f"/achats",
        )

        return receipt

    @staticmethod
    def get_receipt(db: Session, receipt_id: int) -> PurchaseReceipt:
        receipt = (
            db.query(PurchaseReceipt)
            .options(
                selectinload(PurchaseReceipt.items).selectinload(PurchaseReceiptItem.product),
                selectinload(PurchaseReceipt.receiver),
                selectinload(PurchaseReceipt.purchase_order),
            )
            .filter(PurchaseReceipt.id == receipt_id)
            .first()
        )
        if not receipt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de réception introuvable.")
        return receipt

    @staticmethod
    def list_receipts(
        db: Session,
        purchase_order_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[PurchaseReceipt], int]:
        query = db.query(PurchaseReceipt)

        if purchase_order_id:
            query = query.filter(PurchaseReceipt.purchase_order_id == purchase_order_id)

        if start_date:
            query = query.filter(PurchaseReceipt.receipt_date >= start_date)

        if end_date:
            query = query.filter(PurchaseReceipt.receipt_date <= end_date)

        total = query.count()
        receipts = (
            query.order_by(PurchaseReceipt.receipt_date.desc(), PurchaseReceipt.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return receipts, total
