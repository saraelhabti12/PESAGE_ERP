from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.notification_model import NotificationType
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.product_model import Product
from app.models.sale_model import Sale, SaleItem, SaleStatus
from app.models.stock_model import StockBalance, StockMovementType, Warehouse, WarehouseType
from app.schemas.sale_schemas import SaleCreate, SaleItemCreate, SaleUpdate
from app.services.notification_services import NotificationService
from app.services.stock_services import StockService


class SaleService:
    @staticmethod
    def calculate_line_totals(
        quantity: float,
        unit_price_ht: float,
        tax_rate: float,
        discount_rate: float,
    ) -> Tuple[float, float, float, float]:
        """Calculates line subtotal HT, line discount, line tax, and line total TTC with exact decimal rounding.

        gross = quantity * unit_price
        discount = gross * discount_rate / 100
        subtotal = gross - discount
        tax = subtotal * tax_rate / 100
        total = subtotal + tax
        """
        gross = round(quantity * unit_price_ht, 2)
        line_discount = round(gross * (discount_rate / 100.0), 2)
        line_subtotal_ht = round(gross - line_discount, 2)
        line_tax = round(line_subtotal_ht * (tax_rate / 100.0), 2)
        line_total_ttc = round(line_subtotal_ht + line_tax, 2)
        return line_subtotal_ht, line_discount, line_tax, line_total_ttc

    @staticmethod
    def generate_sale_reference(db: Session) -> str:
        """Generates a sequential sale reference like VTE-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"VTE-{now.strftime('%Y%m')}-"
        count = db.query(func.count(Sale.id)).filter(Sale.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_sale(cls, db: Session, data: SaleCreate, user_id: int) -> Sale:
        # 1. Validate Customer
        customer = db.query(BusinessPartner).filter(BusinessPartner.id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le client avec l'ID {data.customer_id} n'existe pas.",
            )
        if customer.partner_type not in (PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le partenaire '{customer.legal_name}' n'est pas configuré comme client.",
            )
        if not customer.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le client '{customer.legal_name}' est inactif.",
            )

        # 2. Reference validation or generation
        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_sale_reference(db)
        existing = db.query(Sale).filter(Sale.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Une vente avec la référence '{reference}' existe déjà.",
            )

        # 3. Validate and build line items
        order_date = data.order_date or datetime.now(timezone.utc)
        sale = Sale(
            reference=reference,
            customer_id=customer.id,
            order_date=order_date,
            status=SaleStatus.DRAFT,
            payment_terms=data.payment_terms,
            payment_method=data.payment_method,
            delivery_delay=data.delivery_delay,
            realization_delay=data.realization_delay,
            notes=data.notes,
            created_by=user_id,
        )

        total_subtotal_ht = 0.0
        total_discount_amount = 0.0
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

            qty = float(item_data.quantity)
            price = float(item_data.unit_price_ht) if item_data.unit_price_ht is not None else float(product.sale_price)
            tax_rate = float(item_data.tax_rate) if item_data.tax_rate is not None else float(product.tax_rate)
            discount_rate = float(item_data.discount_rate) if item_data.discount_rate is not None else 0.00

            if qty <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La quantité vendue doit être strictement supérieure à 0.",
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

            wh = None
            if product.track_stock:
                if not item_data.warehouse_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Veuillez sélectionner le dépôt source pour le produit '{product.designation}'.",
                    )
                wh = db.query(Warehouse).filter(Warehouse.id == item_data.warehouse_id).first()
                if not wh or not wh.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Le dépôt source sélectionné pour '{product.designation}' est invalide ou inactif.",
                    )
                balance = (
                    db.query(StockBalance)
                    .filter(
                        StockBalance.product_id == product.id,
                        StockBalance.warehouse_id == wh.id,
                    )
                    .first()
                )
                avail = float(balance.available_quantity) if balance else 0.0
                if avail < qty:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stock insuffisant. Disponible : {avail}",
                    )

            line_subtotal, line_discount, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

            sale_item = SaleItem(
                product_id=product.id,
                warehouse_id=wh.id if (product.track_stock and wh) else (item_data.warehouse_id or None),
                quantity=qty,
                unit_price_ht=price,
                tax_rate=tax_rate,
                discount_rate=discount_rate,
                line_subtotal_ht=line_subtotal,
                line_discount=line_discount,
                line_tax=line_tax,
                line_total_ttc=line_ttc,
            )
            sale.items.append(sale_item)

            total_subtotal_ht += line_subtotal
            total_discount_amount += line_discount
            total_tax_amount += line_tax
            total_ttc += line_ttc

        sale.subtotal_ht = round(total_subtotal_ht, 2)
        sale.discount_amount = round(total_discount_amount, 2)
        sale.tax_amount = round(total_tax_amount, 2)
        sale.total_ttc = round(total_ttc, 2)

        db.add(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @classmethod
    def update_sale(cls, db: Session, sale_id: int, data: SaleUpdate) -> Sale:
        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        if sale.status != SaleStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Seules les ventes au statut 'DRAFT' peuvent être modifiées (Statut actuel: '{sale.status.value}').",
            )

        if data.customer_id is not None and data.customer_id != sale.customer_id:
            customer = db.query(BusinessPartner).filter(BusinessPartner.id == data.customer_id).first()
            if not customer:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client introuvable.")
            if customer.partner_type not in (PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le partenaire n'est pas un client.")
            if not customer.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le client est inactif.")
            sale.customer_id = customer.id

        if data.order_date is not None:
            sale.order_date = data.order_date
        if data.payment_terms is not None:
            sale.payment_terms = data.payment_terms
        if data.payment_method is not None:
            sale.payment_method = data.payment_method
        if data.delivery_delay is not None:
            sale.delivery_delay = data.delivery_delay
        if data.realization_delay is not None:
            sale.realization_delay = data.realization_delay
        if data.notes is not None:
            sale.notes = data.notes

        if data.items is not None:
            sale.items.clear()
            total_subtotal_ht = 0.0
            total_discount_amount = 0.0
            total_tax_amount = 0.0
            total_ttc = 0.0

            for item_data in data.items:
                product = db.query(Product).filter(Product.id == item_data.product_id).first()
                if not product or not product.is_active:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Produit invalide ou inactif.")

                qty = float(item_data.quantity)
                price = float(item_data.unit_price_ht) if item_data.unit_price_ht is not None else float(product.sale_price)
                tax_rate = float(item_data.tax_rate) if item_data.tax_rate is not None else float(product.tax_rate)
                discount_rate = float(item_data.discount_rate) if item_data.discount_rate is not None else 0.00

                if qty <= 0:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La quantité vendue doit être supérieure à 0.")
                if price < 0 or tax_rate < 0 or discount_rate < 0 or discount_rate > 100:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valeurs tarifaires invalides.")

                wh = None
                if product.track_stock:
                    if not item_data.warehouse_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Veuillez sélectionner le dépôt source pour le produit '{product.designation}'.",
                        )
                    wh = db.query(Warehouse).filter(Warehouse.id == item_data.warehouse_id).first()
                    if not wh or not wh.is_active:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Le dépôt source sélectionné pour '{product.designation}' est invalide ou inactif.",
                        )
                    balance = (
                        db.query(StockBalance)
                        .filter(
                            StockBalance.product_id == product.id,
                            StockBalance.warehouse_id == wh.id,
                        )
                        .first()
                    )
                    avail = float(balance.available_quantity) if balance else 0.0
                    if avail < qty:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Stock insuffisant. Disponible : {avail}",
                        )

                line_subtotal, line_discount, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

                sale_item = SaleItem(
                    product_id=product.id,
                    warehouse_id=wh.id if (product.track_stock and wh) else (item_data.warehouse_id or None),
                    quantity=qty,
                    unit_price_ht=price,
                    tax_rate=tax_rate,
                    discount_rate=discount_rate,
                    line_subtotal_ht=line_subtotal,
                    line_discount=line_discount,
                    line_tax=line_tax,
                    line_total_ttc=line_ttc,
                )
                sale.items.append(sale_item)

                total_subtotal_ht += line_subtotal
                total_discount_amount += line_discount
                total_tax_amount += line_tax
                total_ttc += line_ttc

            sale.subtotal_ht = round(total_subtotal_ht, 2)
            sale.discount_amount = round(total_discount_amount, 2)
            sale.tax_amount = round(total_tax_amount, 2)
            sale.total_ttc = round(total_ttc, 2)

        sale.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sale)
        return sale

    @classmethod
    def confirm_sale(cls, db: Session, sale_id: int, user_id: int) -> Sale:
        """Confirms sale order and atomically validates and exits stock for tracked products from each line's exact source warehouse."""
        sale = (
            db.query(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.warehouse),
                selectinload(Sale.customer),
                selectinload(Sale.creator),
            )
            .filter(Sale.id == sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        if sale.status == SaleStatus.CONFIRMED:
            return sale

        if sale.status == SaleStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de confirmer une vente déjà annulée.",
            )

        if not sale.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La vente doit contenir au moins une ligne d'article pour être confirmée.",
            )

        # 1. Validation pass: Exact stock validation for all stock-tracked products in their assigned warehouse
        for item in sale.items:
            product = item.product or db.query(Product).filter(Product.id == item.product_id).first()
            if not product or not product.track_stock:
                continue

            if not item.warehouse_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Veuillez sélectionner le dépôt source pour le produit '{product.designation}'.",
                )

            wh = item.warehouse or db.query(Warehouse).filter(Warehouse.id == item.warehouse_id).first()
            if not wh or not wh.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le dépôt source pour le produit '{product.designation}' est invalide ou inactif.",
                )

            balance = (
                db.query(StockBalance)
                .filter(
                    StockBalance.product_id == product.id,
                    StockBalance.warehouse_id == wh.id,
                )
                .first()
            )
            avail = float(balance.available_quantity) if balance else 0.0
            requested_qty = float(item.quantity)

            if avail < requested_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stock insuffisant dans le dépôt '{wh.name}' pour le produit '{product.designation}' (Disponible : {avail}, Demandé : {requested_qty}).",
                )

        # 2. Deduction pass: Atomically deduct stock from the exact specified source warehouse
        for item in sale.items:
            product = item.product or db.query(Product).filter(Product.id == item.product_id).first()
            if not product or not product.track_stock:
                continue

            requested_qty = float(item.quantity)
            StockService.remove_stock(
                db=db,
                product_id=product.id,
                warehouse_id=item.warehouse_id,
                quantity=requested_qty,
                movement_type=StockMovementType.SALE,
                reference_type="SALE",
                reference_id=sale.id,
                reason=f"Vente validée {sale.reference}",
                user_id=user_id,
            )

        # 3. Update Sale Status
        sale.status = SaleStatus.CONFIRMED
        sale.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(sale)

        # Trigger notification
        NotificationService.create_notification(
            db=db,
            title="Vente confirmée",
            message=f"La vente {sale.reference} au client {sale.customer.legal_name if sale.customer else ''} a été confirmée avec succès.",
            type=NotificationType.SUCCESS,
            user_id=sale.created_by,
            link="/ventes",
        )

        return sale

    @classmethod
    def cancel_sale(cls, db: Session, sale_id: int, user_id: int) -> Sale:
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

        if sale.status == SaleStatus.CANCELLED:
            return sale

        # If sale was confirmed, reverse the stock movements to each item's source warehouse
        if sale.status == SaleStatus.CONFIRMED:
            for item in sale.items:
                product = item.product or db.query(Product).filter(Product.id == item.product_id).first()
                if product and product.track_stock and item.warehouse_id:
                    StockService.add_stock(
                        db=db,
                        product_id=product.id,
                        warehouse_id=item.warehouse_id,
                        quantity=float(item.quantity),
                        movement_type=StockMovementType.RETURN_IN,
                        reference_type="SALE_CANCEL",
                        reference_id=sale.id,
                        reason=f"Annulation vente {sale.reference}",
                        user_id=user_id,
                    )

        sale.status = SaleStatus.CANCELLED
        sale.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def delete_sale(db: Session, sale_id: int) -> None:
        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")

        if sale.status not in (SaleStatus.DRAFT, SaleStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seules les ventes au statut 'DRAFT' ou 'CANCELLED' peuvent être supprimées.",
            )

        db.delete(sale)
        db.commit()

    @staticmethod
    def get_sale(db: Session, sale_id: int) -> Sale:
        sale = (
            db.query(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.warehouse),
                selectinload(Sale.customer),
                selectinload(Sale.creator),
            )
            .filter(Sale.id == sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vente introuvable.")
        return sale

    @staticmethod
    def list_sales(
        db: Session,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Sale], int]:
        query = (
            db.query(Sale)
            .join(Sale.customer)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.warehouse),
                selectinload(Sale.customer),
                selectinload(Sale.creator),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Sale.reference.ilike(s),
                    BusinessPartner.legal_name.ilike(s),
                    BusinessPartner.trade_name.ilike(s),
                    BusinessPartner.code.ilike(s),
                )
            )

        if customer_id:
            query = query.filter(Sale.customer_id == customer_id)

        if status_filter and status_filter != "all":
            query = query.filter(Sale.status == status_filter)

        if date_from:
            query = query.filter(Sale.order_date >= date_from)

        if date_to:
            query = query.filter(Sale.order_date <= date_to)

        total = query.count()
        sales = query.order_by(Sale.order_date.desc(), Sale.id.desc()).offset(skip).limit(limit).all()
        return sales, total
