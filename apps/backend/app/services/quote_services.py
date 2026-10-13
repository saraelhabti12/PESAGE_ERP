from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.notification_model import NotificationType
from app.models.partner_model import BusinessPartner, PartnerType
from app.models.product_model import Product
from app.models.quote_model import Quote, QuoteItem, QuoteStatus
from app.models.sale_model import Sale, SaleItem, SaleStatus
from app.models.stock_model import Warehouse
from app.schemas.quote_schemas import QuoteCreate, QuoteUpdate
from app.services.notification_services import NotificationService


class QuoteService:
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
    def generate_quote_reference(db: Session) -> str:
        """Generates a sequential quote reference like DEV-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"DEV-{now.strftime('%Y%m')}-"
        count = db.query(func.count(Quote.id)).filter(Quote.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_quote(cls, db: Session, data: QuoteCreate, user_id: int) -> Quote:
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
        reference = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_quote_reference(db)
        existing = db.query(Quote).filter(Quote.reference == reference).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un devis avec la référence '{reference}' existe déjà.",
            )

        # 3. Validate and build line items
        quote_date = data.quote_date or datetime.now(timezone.utc)
        quote = Quote(
            reference=reference,
            customer_id=customer.id,
            quote_date=quote_date,
            valid_until=data.valid_until,
            status=QuoteStatus.DRAFT,
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
                    detail="La quantité du devis doit être strictement supérieure à 0.",
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

            line_subtotal, line_discount, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

            quote_item = QuoteItem(
                product_id=product.id,
                quantity=qty,
                unit_price_ht=price,
                tax_rate=tax_rate,
                discount_rate=discount_rate,
                line_subtotal_ht=line_subtotal,
                line_discount=line_discount,
                line_tax=line_tax,
                line_total_ttc=line_ttc,
            )
            quote.items.append(quote_item)

            total_subtotal_ht += line_subtotal
            total_discount_amount += line_discount
            total_tax_amount += line_tax
            total_ttc += line_ttc

        quote.subtotal_ht = round(total_subtotal_ht, 2)
        quote.discount_amount = round(total_discount_amount, 2)
        quote.tax_amount = round(total_tax_amount, 2)
        quote.total_ttc = round(total_ttc, 2)

        db.add(quote)
        db.commit()
        db.refresh(quote)
        return quote

    @classmethod
    def update_quote(cls, db: Session, quote_id: int, data: QuoteUpdate) -> Quote:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")

        if quote.status != QuoteStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Seuls les devis au statut 'DRAFT' peuvent être modifiés (Statut actuel: '{quote.status.value}').",
            )

        if data.customer_id is not None and data.customer_id != quote.customer_id:
            customer = db.query(BusinessPartner).filter(BusinessPartner.id == data.customer_id).first()
            if not customer:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client introuvable.")
            if customer.partner_type not in (PartnerType.CUSTOMER, PartnerType.CUSTOMER_SUPPLIER):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le partenaire n'est pas un client.")
            if not customer.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le client est inactif.")
            quote.customer_id = customer.id

        if data.quote_date is not None:
            quote.quote_date = data.quote_date
        if data.valid_until is not None:
            quote.valid_until = data.valid_until
        if data.payment_terms is not None:
            quote.payment_terms = data.payment_terms
        if data.payment_method is not None:
            quote.payment_method = data.payment_method
        if data.delivery_delay is not None:
            quote.delivery_delay = data.delivery_delay
        if data.realization_delay is not None:
            quote.realization_delay = data.realization_delay
        if data.notes is not None:
            quote.notes = data.notes

        if data.items is not None:
            quote.items.clear()
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
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La quantité doit être supérieure à 0.")
                if price < 0 or tax_rate < 0 or discount_rate < 0 or discount_rate > 100:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valeurs tarifaires invalides.")

                line_subtotal, line_discount, line_tax, line_ttc = cls.calculate_line_totals(qty, price, tax_rate, discount_rate)

                quote_item = QuoteItem(
                    product_id=product.id,
                    quantity=qty,
                    unit_price_ht=price,
                    tax_rate=tax_rate,
                    discount_rate=discount_rate,
                    line_subtotal_ht=line_subtotal,
                    line_discount=line_discount,
                    line_tax=line_tax,
                    line_total_ttc=line_ttc,
                )
                quote.items.append(quote_item)

                total_subtotal_ht += line_subtotal
                total_discount_amount += line_discount
                total_tax_amount += line_tax
                total_ttc += line_ttc

            quote.subtotal_ht = round(total_subtotal_ht, 2)
            quote.discount_amount = round(total_discount_amount, 2)
            quote.tax_amount = round(total_tax_amount, 2)
            quote.total_ttc = round(total_ttc, 2)

        quote.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quote)
        return quote

    @classmethod
    def send_quote(cls, db: Session, quote_id: int) -> Quote:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")
        if quote.status != QuoteStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Seuls les devis au statut 'DRAFT' peuvent être marqués comme envoyés.",
            )
        quote.status = QuoteStatus.SENT
        quote.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quote)
        return quote

    @classmethod
    def accept_quote(cls, db: Session, quote_id: int) -> Quote:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")
        if quote.status in (QuoteStatus.ACCEPTED, QuoteStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Impossible d'accepter un devis avec le statut '{quote.status.value}'.",
            )
        quote.status = QuoteStatus.ACCEPTED
        quote.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quote)
        return quote

    @classmethod
    def reject_quote(cls, db: Session, quote_id: int) -> Quote:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")
        if quote.status in (QuoteStatus.ACCEPTED, QuoteStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Impossible de refuser un devis avec le statut '{quote.status.value}'.",
            )
        quote.status = QuoteStatus.REJECTED
        quote.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quote)
        return quote

    @classmethod
    def cancel_quote(cls, db: Session, quote_id: int) -> Quote:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")
        quote.status = QuoteStatus.CANCELLED
        quote.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(quote)
        return quote

    @classmethod
    def convert_to_sale(cls, db: Session, quote_id: int, user_id: int) -> Sale:
        quote = (
            db.query(Quote)
            .options(
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.customer),
            )
            .filter(Quote.id == quote_id)
            .first()
        )
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")

        # Check if already converted
        existing_sale = db.query(Sale).filter(Sale.quote_id == quote.id).first()
        if existing_sale:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ce devis a déjà été converti en vente ({existing_sale.reference}).",
            )

        if quote.status == QuoteStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de convertir un devis annulé.",
            )

        # Mark quote as ACCEPTED if not already
        if quote.status != QuoteStatus.ACCEPTED:
            quote.status = QuoteStatus.ACCEPTED
            quote.updated_at = datetime.now(timezone.utc)

        # Look for a default active warehouse for stock-tracked items
        default_wh = db.query(Warehouse).filter(Warehouse.is_active == True).order_by(Warehouse.id.asc()).first()

        # Generate sale reference
        sale_now = datetime.now(timezone.utc)
        sale_prefix = f"VTE-{sale_now.strftime('%Y%m')}-"
        count = db.query(func.count(Sale.id)).filter(Sale.reference.like(f"{sale_prefix}%")).scalar() or 0
        sale_ref = f"{sale_prefix}{count + 1:04d}"

        sale = Sale(
            reference=sale_ref,
            customer_id=quote.customer_id,
            quote_id=quote.id,
            order_date=datetime.now(timezone.utc),
            status=SaleStatus.DRAFT,
            payment_terms=quote.payment_terms,
            payment_method=quote.payment_method,
            delivery_delay=quote.delivery_delay,
            realization_delay=quote.realization_delay,
            notes=f"Converti depuis le devis {quote.reference}." + (f" {quote.notes}" if quote.notes else ""),
            subtotal_ht=quote.subtotal_ht,
            discount_amount=quote.discount_amount,
            tax_amount=quote.tax_amount,
            total_ttc=quote.total_ttc,
            created_by=user_id,
        )

        for q_item in quote.items:
            product = q_item.product or db.query(Product).filter(Product.id == q_item.product_id).first()
            wh_id = default_wh.id if (product and product.track_stock and default_wh) else None

            sale_item = SaleItem(
                product_id=q_item.product_id,
                warehouse_id=wh_id,
                quantity=q_item.quantity,
                unit_price_ht=q_item.unit_price_ht,
                tax_rate=q_item.tax_rate,
                discount_rate=q_item.discount_rate,
                line_subtotal_ht=q_item.line_subtotal_ht,
                line_discount=q_item.line_discount,
                line_tax=q_item.line_tax,
                line_total_ttc=q_item.line_total_ttc,
            )
            sale.items.append(sale_item)

        db.add(sale)
        db.commit()
        db.refresh(sale)

        # Notify
        NotificationService.create_notification(
            db=db,
            title="Devis converti en vente",
            message=f"Le devis {quote.reference} a été converti en vente {sale.reference}.",
            type=NotificationType.SUCCESS,
            user_id=user_id,
            link="/ventes",
        )

        return sale

    @staticmethod
    def delete_quote(db: Session, quote_id: int) -> None:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")

        if quote.status not in (QuoteStatus.DRAFT, QuoteStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seuls les devis au statut 'DRAFT' ou 'CANCELLED' peuvent être supprimés.",
            )

        db.delete(quote)
        db.commit()

    @staticmethod
    def get_quote(db: Session, quote_id: int) -> Quote:
        quote = (
            db.query(Quote)
            .options(
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.customer),
                selectinload(Quote.creator),
            )
            .filter(Quote.id == quote_id)
            .first()
        )
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable.")
        return quote

    @staticmethod
    def list_quotes(
        db: Session,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Quote], int]:
        query = (
            db.query(Quote)
            .join(Quote.customer)
            .options(
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.customer),
                selectinload(Quote.creator),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Quote.reference.ilike(s),
                    BusinessPartner.legal_name.ilike(s),
                    BusinessPartner.trade_name.ilike(s),
                    BusinessPartner.code.ilike(s),
                )
            )

        if customer_id:
            query = query.filter(Quote.customer_id == customer_id)

        if status_filter and status_filter != "all":
            query = query.filter(Quote.status == status_filter)

        if date_from:
            query = query.filter(Quote.quote_date >= date_from)

        if date_to:
            query = query.filter(Quote.quote_date <= date_to)

        total = query.count()
        quotes = query.order_by(Quote.quote_date.desc(), Quote.id.desc()).offset(skip).limit(limit).all()
        return quotes, total
