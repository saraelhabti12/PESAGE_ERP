from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException, status

from app.models.product_model import Product
from app.models.stock_model import (
    Warehouse,
    WarehouseType,
    StockBalance,
    StockMovement,
    StockMovementType,
    StockReservation,
    StockReservationStatus,
    InventorySession,
    InventorySessionStatus,
    InventoryItem,
)
from app.models.purchase_model import PurchaseReceipt
from app.schemas.stock_schemas import (
    WarehouseCreate,
    WarehouseUpdate,
)


class WarehouseService:
    @staticmethod
    def get_warehouse(db: Session, warehouse_id: int) -> Warehouse:
        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Le dépôt avec l'ID {warehouse_id} est introuvable.",
            )
        return warehouse

    @staticmethod
    def get_warehouse_by_code(db: Session, code: str) -> Optional[Warehouse]:
        return db.query(Warehouse).filter(func.lower(Warehouse.code) == code.strip().lower()).first()

    @classmethod
    def create_warehouse(cls, db: Session, data: WarehouseCreate) -> Warehouse:
        existing = cls.get_warehouse_by_code(db, data.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un dépôt avec le code '{data.code}' existe déjà.",
            )

        warehouse = Warehouse(
            code=data.code.strip().upper(),
            name=data.name.strip(),
            type=data.type,
            address=data.address.strip() if data.address else None,
            description=data.description.strip() if data.description else None,
            is_active=data.is_active,
        )
        db.add(warehouse)
        db.commit()
        db.refresh(warehouse)
        return warehouse

    @classmethod
    def update_warehouse(cls, db: Session, warehouse_id: int, data: WarehouseUpdate) -> Warehouse:
        warehouse = cls.get_warehouse(db, warehouse_id)

        if data.code is not None and data.code.strip():
            new_code = data.code.strip().upper()
            if new_code != warehouse.code:
                existing = db.query(Warehouse).filter(
                    func.upper(Warehouse.code) == new_code,
                    Warehouse.id != warehouse_id,
                ).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Un dépôt avec le code '{new_code}' existe déjà.",
                    )
                warehouse.code = new_code

        if data.name is not None:
            warehouse.name = data.name.strip()
        if data.type is not None:
            warehouse.type = data.type
        if data.address is not None:
            warehouse.address = data.address.strip() if data.address else None
        if data.description is not None:
            warehouse.description = data.description.strip() if data.description else None
        if data.is_active is not None:
            warehouse.is_active = data.is_active

        warehouse.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(warehouse)
        return warehouse

    @classmethod
    def delete_warehouse(cls, db: Session, warehouse_id: int) -> None:
        warehouse = cls.get_warehouse(db, warehouse_id)

        # Check if movements exist
        movements_count = db.query(StockMovement).filter(StockMovement.warehouse_id == warehouse_id).count()
        if movements_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de supprimer un dépôt possédant un historique de mouvements.",
            )

        # Check if stock > 0
        positive_stock = (
            db.query(func.coalesce(func.sum(StockBalance.quantity), 0))
            .filter(StockBalance.warehouse_id == warehouse_id)
            .scalar()
        )
        if positive_stock > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de supprimer un dépôt contenant du stock.",
            )

        db.delete(warehouse)
        db.commit()

    @staticmethod
    def list_warehouses(
        db: Session,
        search: Optional[str] = None,
        type_filter: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[Warehouse]:
        query = db.query(Warehouse)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(or_(Warehouse.code.ilike(s), Warehouse.name.ilike(s), Warehouse.address.ilike(s)))
        if type_filter:
            query = query.filter(Warehouse.type == type_filter)
        if is_active is not None:
            query = query.filter(Warehouse.is_active == is_active)

        return query.order_by(Warehouse.name.asc()).all()


class StockService:
    @staticmethod
    def get_or_create_balance(db: Session, product_id: int, warehouse_id: int) -> StockBalance:
        balance = (
            db.query(StockBalance)
            .filter(StockBalance.product_id == product_id, StockBalance.warehouse_id == warehouse_id)
            .first()
        )
        if not balance:
            balance = StockBalance(
                product_id=product_id,
                warehouse_id=warehouse_id,
                quantity=0.00,
                reserved_quantity=0.00,
                minimum_quantity=0.00,
                maximum_quantity=None,
            )
            db.add(balance)
            db.flush()
        return balance

    @classmethod
    def add_stock(
        cls,
        db: Session,
        product_id: int,
        warehouse_id: int,
        quantity: float,
        movement_type: StockMovementType,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        reason: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> StockBalance:
        qty = float(quantity)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La quantité à ajouter doit être strictement positive.",
            )

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")

        if not product.track_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce produit est configuré hors stock.",
            )

        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse or not warehouse.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le dépôt spécifié est invalide ou inactif.",
            )

        balance = cls.get_or_create_balance(db, product_id, warehouse_id)
        balance.quantity = round(float(balance.quantity) + qty, 2)
        balance.updated_at = datetime.now(timezone.utc)

        # Create movement record
        movement = StockMovement(
            product_id=product_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            quantity=qty,
            reference_type=reference_type,
            reference_id=reference_id,
            reason=reason,
            created_by=user_id,
        )
        db.add(movement)
        db.flush()
        return balance

    @classmethod
    def remove_stock(
        cls,
        db: Session,
        product_id: int,
        warehouse_id: int,
        quantity: float,
        movement_type: StockMovementType,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        reason: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> StockBalance:
        qty = float(quantity)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La quantité à retirer doit être strictement positive.",
            )

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")

        if not product.track_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce produit est configuré hors stock.",
            )

        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse or not warehouse.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le dépôt spécifié est invalide ou inactif.",
            )

        balance = cls.get_or_create_balance(db, product_id, warehouse_id)
        available = balance.available_quantity
        if qty > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock disponible insuffisant dans le dépôt '{warehouse.name}' (Disponible: {available}, Demandé: {qty}).",
            )

        balance.quantity = round(float(balance.quantity) - qty, 2)
        balance.updated_at = datetime.now(timezone.utc)

        # Create movement record
        movement = StockMovement(
            product_id=product_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            quantity=qty,
            reference_type=reference_type,
            reference_id=reference_id,
            reason=reason,
            created_by=user_id,
        )
        db.add(movement)
        db.flush()
        return balance

    @classmethod
    def transfer_stock(
        cls,
        db: Session,
        product_id: int,
        source_warehouse_id: int,
        dest_warehouse_id: int,
        quantity: float,
        reason: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Tuple[StockBalance, StockBalance]:
        if source_warehouse_id == dest_warehouse_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Les dépôts source et destination doivent être différents.",
            )

        qty = float(quantity)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La quantité à transférer doit être strictement positive.",
            )

        source_wh = db.query(Warehouse).filter(Warehouse.id == source_warehouse_id).first()
        dest_wh = db.query(Warehouse).filter(Warehouse.id == dest_warehouse_id).first()
        if not source_wh or not dest_wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Un ou plusieurs dépôts sont introuvables.",
            )
        if not source_wh.is_active or not dest_wh.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Les deux dépôts doivent être actifs pour effectuer un transfert.",
            )

        # Atomically remove from source and add to dest
        source_bal = cls.remove_stock(
            db=db,
            product_id=product_id,
            warehouse_id=source_warehouse_id,
            quantity=qty,
            movement_type=StockMovementType.TRANSFER_OUT,
            reference_type="TRANSFER",
            reason=reason or f"Transfert vers {dest_wh.name}",
            user_id=user_id,
        )

        dest_bal = cls.add_stock(
            db=db,
            product_id=product_id,
            warehouse_id=dest_warehouse_id,
            quantity=qty,
            movement_type=StockMovementType.TRANSFER_IN,
            reference_type="TRANSFER",
            reason=reason or f"Transfert depuis {source_wh.name}",
            user_id=user_id,
        )

        db.commit()
        db.refresh(source_bal)
        db.refresh(dest_bal)
        return source_bal, dest_bal

    @classmethod
    def reserve_stock(
        cls,
        db: Session,
        product_id: int,
        warehouse_id: int,
        quantity: float,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        user_id: int = None,
    ) -> StockReservation:
        qty = float(quantity)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La quantité réservée doit être strictement positive.",
            )

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
        if not product.track_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce produit est configuré hors stock.",
            )

        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse or not warehouse.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le dépôt spécifié est invalide ou inactif.",
            )

        balance = cls.get_or_create_balance(db, product_id, warehouse_id)
        available = balance.available_quantity
        if qty > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock disponible insuffisant pour la réservation (Disponible: {available}, Demandé: {qty}).",
            )

        balance.reserved_quantity = round(float(balance.reserved_quantity) + qty, 2)
        balance.updated_at = datetime.now(timezone.utc)

        reservation = StockReservation(
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity=qty,
            reference_type=reference_type,
            reference_id=reference_id,
            status=StockReservationStatus.ACTIVE,
            reserved_by=user_id,
        )
        db.add(reservation)
        db.commit()
        db.refresh(reservation)
        return reservation

    @classmethod
    def release_reservation(cls, db: Session, reservation_id: int, user_id: int) -> StockReservation:
        reservation = db.query(StockReservation).filter(StockReservation.id == reservation_id).first()
        if not reservation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Réservation introuvable.")

        if reservation.status != StockReservationStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La réservation n'est pas active (Statut: {reservation.status.value}).",
            )

        balance = cls.get_or_create_balance(db, reservation.product_id, reservation.warehouse_id)
        balance.reserved_quantity = max(0.0, round(float(balance.reserved_quantity) - float(reservation.quantity), 2))
        balance.updated_at = datetime.now(timezone.utc)

        reservation.status = StockReservationStatus.RELEASED
        reservation.released_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(reservation)
        return reservation

    @classmethod
    def consume_reservation(cls, db: Session, reservation_id: int, user_id: int) -> StockReservation:
        reservation = db.query(StockReservation).filter(StockReservation.id == reservation_id).first()
        if not reservation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Réservation introuvable.")

        if reservation.status != StockReservationStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La réservation n'est pas active (Statut: {reservation.status.value}).",
            )

        qty = float(reservation.quantity)
        balance = cls.get_or_create_balance(db, reservation.product_id, reservation.warehouse_id)
        balance.reserved_quantity = max(0.0, round(float(balance.reserved_quantity) - qty, 2))
        balance.quantity = max(0.0, round(float(balance.quantity) - qty, 2))
        balance.updated_at = datetime.now(timezone.utc)

        movement = StockMovement(
            product_id=reservation.product_id,
            warehouse_id=reservation.warehouse_id,
            movement_type=StockMovementType.SALE,
            quantity=qty,
            reference_type=reservation.reference_type,
            reference_id=reservation.reference_id,
            reason="Consommation de la réservation",
            created_by=user_id,
        )
        db.add(movement)

        reservation.status = StockReservationStatus.CONSUMED
        reservation.released_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(reservation)
        return reservation

    @classmethod
    def adjust_stock(
        cls,
        db: Session,
        product_id: int,
        warehouse_id: int,
        new_quantity: float,
        reason: str,
        user_id: int,
    ) -> StockBalance:
        new_qty = float(new_quantity)
        if new_qty < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La nouvelle quantité doit être supérieure ou égale à 0.",
            )

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
        if not product.track_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce produit est configuré hors stock.",
            )

        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse or not warehouse.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le dépôt spécifié est invalide ou inactif.",
            )

        balance = cls.get_or_create_balance(db, product_id, warehouse_id)
        current_qty = float(balance.quantity)
        diff = round(new_qty - current_qty, 2)

        if diff == 0:
            return balance

        if diff > 0:
            balance.quantity = new_qty
            balance.updated_at = datetime.now(timezone.utc)
            movement = StockMovement(
                product_id=product_id,
                warehouse_id=warehouse_id,
                movement_type=StockMovementType.ADJUSTMENT_IN,
                quantity=diff,
                reference_type="ADJUSTMENT",
                reason=reason,
                created_by=user_id,
            )
            db.add(movement)
        else:
            abs_diff = abs(diff)
            if new_qty < float(balance.reserved_quantity):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La quantité ({new_qty}) ne peut pas être inférieure à la quantité réservée ({balance.reserved_quantity}).",
                )
            balance.quantity = new_qty
            balance.updated_at = datetime.now(timezone.utc)
            movement = StockMovement(
                product_id=product_id,
                warehouse_id=warehouse_id,
                movement_type=StockMovementType.ADJUSTMENT_OUT,
                quantity=abs_diff,
                reference_type="ADJUSTMENT",
                reason=reason,
                created_by=user_id,
            )
            db.add(movement)

        db.commit()
        db.refresh(balance)
        return balance

    @classmethod
    def update_thresholds(
        cls,
        db: Session,
        balance_id: int,
        min_quantity: float,
        max_quantity: Optional[float],
    ) -> StockBalance:
        balance = db.query(StockBalance).filter(StockBalance.id == balance_id).first()
        if not balance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne de stock introuvable.")

        if max_quantity is not None and max_quantity < min_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le seuil maximum doit être supérieur ou égal au seuil minimum.",
            )

        balance.minimum_quantity = round(float(min_quantity), 2)
        balance.maximum_quantity = round(float(max_quantity), 2) if max_quantity is not None else None
        balance.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(balance)
        return balance

    @classmethod
    def process_purchase_receipt(cls, db: Session, receipt: PurchaseReceipt, user_id: int) -> None:
        """Called upon purchase receipt creation/confirmation to increase stock atomically."""
        # Find default fallback warehouse if receipt item doesn't specify one
        default_wh = (
            db.query(Warehouse)
            .filter(Warehouse.is_active == True)
            .order_by(Warehouse.type == WarehouseType.MAIN, Warehouse.id.asc())
            .first()
        )
        if not default_wh:
            # Create default main warehouse if none exists
            default_wh = Warehouse(
                code="MAG-001",
                name="Dépôt Principal",
                type=WarehouseType.MAIN,
                description="Dépôt principal initialisé automatiquement",
                is_active=True,
            )
            db.add(default_wh)
            db.flush()

        for item in receipt.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product or not product.track_stock:
                continue

            target_wh_id = item.warehouse_id or default_wh.id
            cls.add_stock(
                db=db,
                product_id=product.id,
                warehouse_id=target_wh_id,
                quantity=float(item.quantity_received),
                movement_type=StockMovementType.PURCHASE_RECEIPT,
                reference_type="PURCHASE_RECEIPT",
                reference_id=receipt.id,
                reason=f"Réception bon {receipt.reference}",
                user_id=user_id,
            )

    @staticmethod
    def get_product_warehouse_balance(
        db: Session,
        product_id: int,
        warehouse_id: int,
    ) -> dict:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable.")
        if not product.track_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce produit est configuré hors stock.",
            )

        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Le dépôt avec l'ID {warehouse_id} est introuvable.",
            )

        balance = (
            db.query(StockBalance)
            .filter(StockBalance.product_id == product_id, StockBalance.warehouse_id == warehouse_id)
            .first()
        )

        purchase_price = float(product.purchase_price) if product.purchase_price else 0.0
        now = datetime.now(timezone.utc)

        if balance:
            return {
                "id": balance.id,
                "product_id": balance.product_id,
                "warehouse_id": balance.warehouse_id,
                "quantity": float(balance.quantity),
                "reserved_quantity": float(balance.reserved_quantity),
                "available_quantity": balance.available_quantity,
                "minimum_quantity": float(balance.minimum_quantity),
                "maximum_quantity": float(balance.maximum_quantity) if balance.maximum_quantity is not None else None,
                "status": balance.status,
                "valuation": round(float(balance.quantity) * purchase_price, 2),
                "product": balance.product,
                "warehouse": balance.warehouse,
                "created_at": balance.created_at,
                "updated_at": balance.updated_at,
            }
        else:
            return {
                "id": 0,
                "product_id": product.id,
                "warehouse_id": warehouse.id,
                "quantity": 0.00,
                "reserved_quantity": 0.00,
                "available_quantity": 0.00,
                "minimum_quantity": 0.00,
                "maximum_quantity": None,
                "status": "OUT_OF_STOCK",
                "valuation": 0.00,
                "product": product,
                "warehouse": warehouse,
                "created_at": now,
                "updated_at": now,
            }

    @staticmethod
    def list_stock(
        db: Session,
        product_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[dict], int]:
        query = (
            db.query(StockBalance)
            .join(StockBalance.product)
            .join(StockBalance.warehouse)
            .filter(Product.is_active == True, Product.track_stock == True)
        )

        if product_id:
            query = query.filter(StockBalance.product_id == product_id)

        if warehouse_id:
            query = query.filter(StockBalance.warehouse_id == warehouse_id)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Product.sku.ilike(s),
                    Product.designation.ilike(s),
                    Product.barcode.ilike(s),
                    Warehouse.name.ilike(s),
                    Warehouse.code.ilike(s),
                )
            )

        all_balances = query.order_by(Product.designation.asc(), Warehouse.name.asc()).all()

        # Filter by status if specified (calculated property)
        if status_filter and status_filter != "all":
            filtered = [b for b in all_balances if b.status == status_filter]
        else:
            filtered = all_balances

        total = len(filtered)
        paginated = filtered[skip : skip + limit]

        result = []
        for b in paginated:
            purchase_price = float(b.product.purchase_price) if b.product and b.product.purchase_price else 0.0
            val = round(float(b.quantity) * purchase_price, 2)
            result.append(
                {
                    "id": b.id,
                    "product_id": b.product_id,
                    "warehouse_id": b.warehouse_id,
                    "quantity": float(b.quantity),
                    "reserved_quantity": float(b.reserved_quantity),
                    "available_quantity": b.available_quantity,
                    "minimum_quantity": float(b.minimum_quantity),
                    "maximum_quantity": float(b.maximum_quantity) if b.maximum_quantity is not None else None,
                    "status": b.status,
                    "valuation": val,
                    "product": b.product,
                    "warehouse": b.warehouse,
                    "created_at": b.created_at,
                    "updated_at": b.updated_at,
                }
            )
        return result, total

    @staticmethod
    def get_stock_stats(db: Session) -> dict:
        balances = (
            db.query(StockBalance)
            .join(StockBalance.product)
            .filter(Product.is_active == True, Product.track_stock == True)
            .all()
        )

        total_value = sum(
            float(b.quantity) * (float(b.product.purchase_price) if b.product and b.product.purchase_price else 0.0)
            for b in balances
        )
        total_qty = sum(float(b.quantity) for b in balances)
        tracked_count = db.query(Product).filter(Product.track_stock == True, Product.is_active == True).count()

        out_of_stock = sum(1 for b in balances if b.status == "OUT_OF_STOCK")
        low_stock = sum(1 for b in balances if b.status == "LOW")
        overstock = sum(1 for b in balances if b.status == "OVERSTOCK")

        return {
            "total_stock_value": round(total_value, 2),
            "tracked_products_count": tracked_count,
            "out_of_stock_count": out_of_stock,
            "low_stock_count": low_stock,
            "overstock_count": overstock,
            "total_quantity": round(total_qty, 2),
        }

    @staticmethod
    def list_movements(
        db: Session,
        product_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        movement_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[StockMovement], int]:
        query = (
            db.query(StockMovement)
            .options(
                selectinload(StockMovement.product),
                selectinload(StockMovement.warehouse),
                selectinload(StockMovement.creator),
            )
        )

        if product_id:
            query = query.filter(StockMovement.product_id == product_id)
        if warehouse_id:
            query = query.filter(StockMovement.warehouse_id == warehouse_id)
        if movement_type and movement_type != "all":
            query = query.filter(StockMovement.movement_type == movement_type)
        if start_date:
            query = query.filter(StockMovement.created_at >= start_date)
        if end_date:
            query = query.filter(StockMovement.created_at <= end_date)

        total = query.count()
        movements = query.order_by(StockMovement.created_at.desc(), StockMovement.id.desc()).offset(skip).limit(limit).all()
        return movements, total

    @staticmethod
    def list_reservations(
        db: Session,
        product_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[StockReservation], int]:
        query = (
            db.query(StockReservation)
            .options(
                selectinload(StockReservation.product),
                selectinload(StockReservation.warehouse),
                selectinload(StockReservation.user),
            )
        )

        if product_id:
            query = query.filter(StockReservation.product_id == product_id)
        if warehouse_id:
            query = query.filter(StockReservation.warehouse_id == warehouse_id)
        if status_filter and status_filter != "all":
            query = query.filter(StockReservation.status == status_filter)

        total = query.count()
        reservations = query.order_by(StockReservation.created_at.desc()).offset(skip).limit(limit).all()
        return reservations, total


class InventoryService:
    @staticmethod
    def generate_inventory_reference(db: Session) -> str:
        now = datetime.now(timezone.utc)
        prefix = f"INV-{now.strftime('%Y%m')}-"
        count = db.query(func.count(InventorySession.id)).filter(InventorySession.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_session(cls, db: Session, warehouse_id: int, notes: Optional[str], user_id: int) -> InventorySession:
        warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépôt introuvable.")

        ref = cls.generate_inventory_reference(db)
        session = InventorySession(
            warehouse_id=warehouse_id,
            reference=ref,
            status=InventorySessionStatus.DRAFT,
            notes=notes,
            created_by=user_id,
        )
        db.add(session)
        db.flush()

        # Pre-populate all active track_stock products
        products = db.query(Product).filter(Product.track_stock == True, Product.is_active == True).all()
        for prod in products:
            balance = (
                db.query(StockBalance)
                .filter(StockBalance.product_id == prod.id, StockBalance.warehouse_id == warehouse_id)
                .first()
            )
            sys_qty = float(balance.quantity) if balance else 0.00
            item = InventoryItem(
                inventory_session_id=session.id,
                product_id=prod.id,
                system_quantity=sys_qty,
                counted_quantity=sys_qty,
                difference=0.00,
            )
            session.items.append(item)

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_session(db: Session, session_id: int) -> InventorySession:
        session = (
            db.query(InventorySession)
            .options(
                selectinload(InventorySession.items).selectinload(InventoryItem.product),
                selectinload(InventorySession.warehouse),
                selectinload(InventorySession.creator),
                selectinload(InventorySession.validator),
            )
            .filter(InventorySession.id == session_id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session d'inventaire introuvable.")
        return session

    @classmethod
    def start_session(cls, db: Session, session_id: int, user_id: int) -> InventorySession:
        session = cls.get_session(db, session_id)
        if session.status != InventorySessionStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seule une session au statut 'Brouillon' peut être démarrée.",
            )

        session.status = InventorySessionStatus.IN_PROGRESS
        session.started_at = datetime.now(timezone.utc)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return session

    @classmethod
    def update_item_count(
        cls,
        db: Session,
        session_id: int,
        product_id: int,
        counted_quantity: float,
        reason: Optional[str],
    ) -> InventoryItem:
        session = cls.get_session(db, session_id)
        if session.status not in (InventorySessionStatus.DRAFT, InventorySessionStatus.IN_PROGRESS):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de modifier les comptages d'une session terminée ou annulée.",
            )

        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.inventory_session_id == session_id, InventoryItem.product_id == product_id)
            .first()
        )
        if not item:
            item = InventoryItem(
                inventory_session_id=session_id,
                product_id=product_id,
                system_quantity=0.00,
                counted_quantity=counted_quantity,
                difference=counted_quantity,
                reason=reason,
            )
            db.add(item)
        else:
            item.counted_quantity = round(float(counted_quantity), 2)
            item.difference = round(float(counted_quantity) - float(item.system_quantity), 2)
            if reason is not None:
                item.reason = reason

        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(item)
        return item

    @classmethod
    def validate_session(cls, db: Session, session_id: int, user_id: int) -> InventorySession:
        session = cls.get_session(db, session_id)
        if session.status not in (InventorySessionStatus.DRAFT, InventorySessionStatus.IN_PROGRESS):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seule une session en cours ou brouillon peut être validée.",
            )

        # Apply stock adjustments for items where difference != 0
        for item in session.items:
            if float(item.difference) != 0:
                StockService.adjust_stock(
                    db=db,
                    product_id=item.product_id,
                    warehouse_id=session.warehouse_id,
                    new_quantity=float(item.counted_quantity),
                    reason=item.reason or f"Régularisation inventaire {session.reference}",
                    user_id=user_id,
                )

        session.status = InventorySessionStatus.COMPLETED
        session.validated_at = datetime.now(timezone.utc)
        session.validated_by = user_id
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return session

    @classmethod
    def cancel_session(cls, db: Session, session_id: int, user_id: int) -> InventorySession:
        session = cls.get_session(db, session_id)
        if session.status == InventorySessionStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d'annuler une session d'inventaire déjà validée.",
            )

        session.status = InventorySessionStatus.CANCELLED
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def list_sessions(
        db: Session,
        warehouse_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[InventorySession], int]:
        query = (
            db.query(InventorySession)
            .options(
                selectinload(InventorySession.warehouse),
                selectinload(InventorySession.creator),
                selectinload(InventorySession.validator),
                selectinload(InventorySession.items),
            )
        )

        if warehouse_id:
            query = query.filter(InventorySession.warehouse_id == warehouse_id)
        if status_filter and status_filter != "all":
            query = query.filter(InventorySession.status == status_filter)

        total = query.count()
        sessions = query.order_by(InventorySession.created_at.desc()).offset(skip).limit(limit).all()
        return sessions, total
