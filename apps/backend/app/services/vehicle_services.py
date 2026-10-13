from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.employee_model import Employee
from app.models.notification_model import Notification, NotificationType
from app.models.vehicle_model import FuelLog, FuelType, MaintenanceType, Vehicle, VehicleMaintenance, VehicleStatus
from app.schemas.vehicle_schemas import (
    FuelLogCreate,
    VehicleCreate,
    VehicleMaintenanceCreate,
    VehicleStatistics,
    VehicleUpdate,
)
from app.services.notification_services import NotificationService


class VehicleService:
    @staticmethod
    def generate_vehicle_code(db: Session) -> str:
        """Generates sequential vehicle code: VH-YYYY-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"VH-{now.strftime('%Y')}-"
        count = db.query(func.count(Vehicle.id)).filter(Vehicle.vehicle_code.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_vehicle(cls, db: Session, data: VehicleCreate) -> Vehicle:
        reg = data.registration_number.strip().upper()
        existing_reg = db.query(Vehicle).filter(func.upper(Vehicle.registration_number) == reg).first()
        if existing_reg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un véhicule avec l'immatriculation '{reg}' existe déjà.",
            )

        code = data.vehicle_code.strip() if data.vehicle_code and data.vehicle_code.strip() and data.vehicle_code.strip().upper() != "AUTO" else cls.generate_vehicle_code(db)
        existing_code = db.query(Vehicle).filter(Vehicle.vehicle_code == code).first()
        if existing_code:
            count = db.query(func.count(Vehicle.id)).scalar() or 0
            code = f"{code}-{count + 1}"

        if data.default_driver_id:
            driver = db.query(Employee).filter(Employee.id == data.default_driver_id).first()
            if not driver:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conducteur par défaut introuvable.")
            if not driver.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le conducteur sélectionné est inactif.")

        vehicle = Vehicle(
            vehicle_code=code,
            registration_number=reg,
            brand=data.brand.strip(),
            model=data.model.strip(),
            vehicle_type=data.vehicle_type.strip() if data.vehicle_type else None,
            year=data.year,
            vin=data.vin.strip().upper() if data.vin else None,
            first_registration_date=data.first_registration_date,
            current_mileage=float(data.current_mileage),
            fuel_type=data.fuel_type,
            fuel_capacity=data.fuel_capacity,
            status=data.status,
            default_driver_id=data.default_driver_id,
            insurance_expiry=data.insurance_expiry,
            technical_inspection_expiry=data.technical_inspection_expiry,
            registration_expiry=data.registration_expiry,
            tax_expiry=data.tax_expiry,
            notes=data.notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return vehicle

    @classmethod
    def get_vehicle(cls, db: Session, vehicle_id: int) -> Vehicle:
        v = (
            db.query(Vehicle)
            .options(
                selectinload(Vehicle.default_driver),
                selectinload(Vehicle.maintenances).selectinload(VehicleMaintenance.creator),
                selectinload(Vehicle.fuel_logs).selectinload(FuelLog.driver),
                selectinload(Vehicle.fuel_logs).selectinload(FuelLog.creator),
            )
            .filter(Vehicle.id == vehicle_id)
            .first()
        )
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable.")
        return v

    @classmethod
    def update_vehicle(cls, db: Session, vehicle_id: int, data: VehicleUpdate) -> Vehicle:
        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable.")

        update_dict = data.model_dump(exclude_unset=True)

        if "registration_number" in update_dict and update_dict["registration_number"]:
            reg = update_dict["registration_number"].strip().upper()
            if reg != vehicle.registration_number:
                existing = db.query(Vehicle).filter(func.upper(Vehicle.registration_number) == reg, Vehicle.id != vehicle_id).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Un véhicule avec l'immatriculation '{reg}' existe déjà.",
                    )
                vehicle.registration_number = reg

        if "default_driver_id" in update_dict and update_dict["default_driver_id"]:
            driver = db.query(Employee).filter(Employee.id == update_dict["default_driver_id"]).first()
            if not driver:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conducteur spécifié introuvable.")
            if not driver.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le conducteur sélectionné est inactif.")

        for field, val in update_dict.items():
            if field != "registration_number":
                if isinstance(val, str):
                    val = val.strip()
                setattr(vehicle, field, val)

        vehicle.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(vehicle)
        return vehicle

    @classmethod
    def list_vehicles(
        cls,
        db: Session,
        search: Optional[str] = None,
        brand: Optional[str] = None,
        status_filter: Optional[VehicleStatus] = None,
        fuel_type: Optional[FuelType] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Vehicle], int]:
        query = (
            db.query(Vehicle)
            .options(
                selectinload(Vehicle.default_driver),
                selectinload(Vehicle.maintenances),
                selectinload(Vehicle.fuel_logs),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Vehicle.vehicle_code.ilike(s),
                    Vehicle.registration_number.ilike(s),
                    Vehicle.brand.ilike(s),
                    Vehicle.model.ilike(s),
                    Vehicle.vin.ilike(s),
                )
            )

        if brand:
            query = query.filter(Vehicle.brand.ilike(f"%{brand.strip()}%"))

        if status_filter:
            query = query.filter(Vehicle.status == status_filter)

        if fuel_type:
            query = query.filter(Vehicle.fuel_type == fuel_type)

        total = query.count()
        items = query.order_by(Vehicle.brand.asc(), Vehicle.model.asc()).offset(skip).limit(limit).all()
        return items, total

    # ----------------------------------------------------
    # MAINTENANCE RECORDS
    # ----------------------------------------------------
    @classmethod
    def add_maintenance(cls, db: Session, data: VehicleMaintenanceCreate, user_id: int) -> VehicleMaintenance:
        vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable.")

        total_cost = round(float(data.labor_cost) + float(data.parts_cost), 2)
        maint_date = data.maintenance_date or datetime.now(timezone.utc)

        maint = VehicleMaintenance(
            vehicle_id=vehicle.id,
            maintenance_date=maint_date,
            mileage=float(data.mileage),
            maintenance_type=data.maintenance_type,
            description=data.description.strip(),
            supplier=data.supplier.strip() if data.supplier else None,
            labor_cost=float(data.labor_cost),
            parts_cost=float(data.parts_cost),
            total_cost=total_cost,
            next_maintenance_date=data.next_maintenance_date,
            next_maintenance_mileage=data.next_maintenance_mileage,
            notes=data.notes,
            created_by=user_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(maint)

        # Update vehicle mileage if higher
        if float(data.mileage) > float(vehicle.current_mileage):
            vehicle.current_mileage = float(data.mileage)
            vehicle.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(maint)
        return maint

    @classmethod
    def list_maintenances(
        cls,
        db: Session,
        vehicle_id: Optional[int] = None,
        maintenance_type: Optional[MaintenanceType] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[VehicleMaintenance], int]:
        query = (
            db.query(VehicleMaintenance)
            .options(
                selectinload(VehicleMaintenance.vehicle),
                selectinload(VehicleMaintenance.creator),
            )
        )

        if vehicle_id:
            query = query.filter(VehicleMaintenance.vehicle_id == vehicle_id)

        if maintenance_type:
            query = query.filter(VehicleMaintenance.maintenance_type == maintenance_type)

        if date_from:
            query = query.filter(VehicleMaintenance.maintenance_date >= date_from)

        if date_to:
            query = query.filter(VehicleMaintenance.maintenance_date <= date_to)

        total = query.count()
        items = query.order_by(VehicleMaintenance.maintenance_date.desc(), VehicleMaintenance.id.desc()).offset(skip).limit(limit).all()
        return items, total

    # ----------------------------------------------------
    # FUEL LOGS
    # ----------------------------------------------------
    @classmethod
    def add_fuel_log(cls, db: Session, data: FuelLogCreate, user_id: int) -> FuelLog:
        vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable.")

        liters = float(data.liters)
        price = float(data.price_per_liter)
        total_cost = round(liters * price, 2)
        log_date = data.date or datetime.now(timezone.utc)

        fuel = FuelLog(
            vehicle_id=vehicle.id,
            date=log_date,
            mileage=float(data.mileage),
            liters=liters,
            price_per_liter=price,
            total_cost=total_cost,
            station=data.station.strip() if data.station else None,
            driver_id=data.driver_id or vehicle.default_driver_id,
            notes=data.notes,
            created_by=user_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(fuel)

        if float(data.mileage) > float(vehicle.current_mileage):
            vehicle.current_mileage = float(data.mileage)
            vehicle.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(fuel)
        return fuel

    @classmethod
    def list_fuel_logs(
        cls,
        db: Session,
        vehicle_id: Optional[int] = None,
        driver_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[FuelLog], int]:
        query = (
            db.query(FuelLog)
            .options(
                selectinload(FuelLog.vehicle),
                selectinload(FuelLog.driver),
                selectinload(FuelLog.creator),
            )
        )

        if vehicle_id:
            query = query.filter(FuelLog.vehicle_id == vehicle_id)

        if driver_id:
            query = query.filter(FuelLog.driver_id == driver_id)

        if date_from:
            query = query.filter(FuelLog.date >= date_from)

        if date_to:
            query = query.filter(FuelLog.date <= date_to)

        total = query.count()
        items = query.order_by(FuelLog.date.desc(), FuelLog.id.desc()).offset(skip).limit(limit).all()
        return items, total

    # ----------------------------------------------------
    # FLEET STATISTICS
    # ----------------------------------------------------
    @classmethod
    def get_vehicle_statistics(cls, db: Session, vehicle_id: Optional[int] = None) -> VehicleStatistics:
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)

        # Maintenance queries
        m_query = db.query(VehicleMaintenance)
        if vehicle_id:
            m_query = m_query.filter(VehicleMaintenance.vehicle_id == vehicle_id)

        m_month = db.query(func.coalesce(func.sum(VehicleMaintenance.total_cost), 0.0)).filter(
            VehicleMaintenance.maintenance_date >= start_of_month,
            *([VehicleMaintenance.vehicle_id == vehicle_id] if vehicle_id else []),
        ).scalar() or 0.0

        m_year = db.query(func.coalesce(func.sum(VehicleMaintenance.total_cost), 0.0)).filter(
            VehicleMaintenance.maintenance_date >= start_of_year,
            *([VehicleMaintenance.vehicle_id == vehicle_id] if vehicle_id else []),
        ).scalar() or 0.0

        m_total = db.query(func.coalesce(func.sum(VehicleMaintenance.total_cost), 0.0)).filter(
            *([VehicleMaintenance.vehicle_id == vehicle_id] if vehicle_id else []),
        ).scalar() or 0.0

        # Fuel queries
        f_month = db.query(func.coalesce(func.sum(FuelLog.total_cost), 0.0)).filter(
            FuelLog.date >= start_of_month,
            *([FuelLog.vehicle_id == vehicle_id] if vehicle_id else []),
        ).scalar() or 0.0

        f_year = db.query(func.coalesce(func.sum(FuelLog.total_cost), 0.0)).filter(
            FuelLog.date >= start_of_year,
            *([FuelLog.vehicle_id == vehicle_id] if vehicle_id else []),
        ).scalar() or 0.0

        f_total = db.query(func.coalesce(func.sum(FuelLog.total_cost), 0.0)).filter(
            *([FuelLog.vehicle_id == vehicle_id] if vehicle_id else []),
        ).scalar() or 0.0

        total_km = 0.0
        if vehicle_id:
            v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
            if v:
                total_km = float(v.current_mileage)
        else:
            raw_km = db.query(func.coalesce(func.sum(Vehicle.current_mileage), 0.0)).scalar() or 0.0
            total_km = float(raw_km)

        total_expenses = round(float(m_total) + float(f_total), 2)
        cost_per_km = None
        if total_km > 0 and total_expenses > 0:
            cost_per_km = round(total_expenses / total_km, 3)

        return VehicleStatistics(
            fuel_cost_month=round(float(f_month), 2),
            maintenance_cost_month=round(float(m_month), 2),
            fuel_cost_year=round(float(f_year), 2),
            maintenance_cost_year=round(float(m_year), 2),
            total_vehicle_expenses=total_expenses,
            total_kilometers=round(float(total_km), 2),
            cost_per_km=cost_per_km,
        )

    @classmethod
    def check_and_notify_expiring_documents(cls, db: Session) -> dict:
        """Idempotent scheduled alerts for vehicle insurance, technical inspection, and tax expiration within 15 days."""
        now = datetime.now(timezone.utc)
        today = now.date()

        vehicles = db.query(Vehicle).filter(Vehicle.status != VehicleStatus.DECOMMISSIONED).all()
        alerts_created = 0

        for v in vehicles:
            docs = [
                ("Assurance", v.insurance_expiry),
                ("Visite technique", v.technical_inspection_expiry),
                ("Taxe / Vignette", v.tax_expiry),
            ]

            for label, exp_date in docs:
                if exp_date:
                    days_diff = (exp_date.date() - today).days
                    if 0 <= days_diff <= 15:
                        msg = f"{label} du véhicule {v.brand} {v.model} ({v.registration_number}) expire dans {days_diff} jour(s) ({exp_date.date().strftime('%d/%m/%Y')})."
                        exists = db.query(Notification).filter(
                            Notification.message == msg,
                            func.date(Notification.created_at) == today,
                        ).first()
                        if not exists:
                            NotificationService.create_notification(
                                db=db,
                                title=f"Expiration {label} véhicule",
                                message=msg,
                                type=NotificationType.WARNING,
                                user_id=None,
                                link="/vehicules",
                            )
                            alerts_created += 1

        return {"status": "ok", "alerts_created": alerts_created, "vehicles_checked": len(vehicles)}
