from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.employee_model import Employee
from app.models.maintenance_model import (
    Equipment,
    EquipmentStatus,
    EquipmentType,
    Intervention,
    InterventionPart,
    InterventionPriority,
    InterventionStatus,
    InterventionTask,
    InterventionType,
    TaskStatus,
)
from app.models.partner_model import BusinessPartner
from app.models.product_model import Product
from app.schemas.maintenance_schemas import (
    EquipmentCreate,
    EquipmentUpdate,
    InterventionCreate,
    InterventionPartCreate,
    InterventionPartUpdate,
    InterventionStatusUpdate,
    InterventionTaskCreate,
    InterventionTaskUpdate,
    InterventionUpdate,
    MaintenanceStatsResponse,
)


class EquipmentService:
    @staticmethod
    def generate_equipment_code(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        prefix = f"EQ-{current_year}-"
        count = (
            db.query(func.count(Equipment.id))
            .filter(Equipment.equipment_code.like(f"{prefix}%"))
            .scalar()
            or 0
        )
        return f"{prefix}{count + 1:04d}"

    @staticmethod
    def create_equipment(db: Session, data: EquipmentCreate) -> Equipment:
        # Validate customer
        customer = db.query(BusinessPartner).filter(BusinessPartner.id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID {data.customer_id} not found",
            )

        code = data.equipment_code or EquipmentService.generate_equipment_code(db)
        
        # Check uniqueness of code
        existing = db.query(Equipment).filter(Equipment.equipment_code == code).first()
        if existing:
            code = EquipmentService.generate_equipment_code(db)

        equipment = Equipment(
            equipment_code=code,
            customer_id=data.customer_id,
            designation=data.designation,
            equipment_type=data.equipment_type,
            brand=data.brand,
            model=data.model,
            serial_number=data.serial_number,
            site_name=data.site_name,
            site_address=data.site_address,
            city=data.city,
            installation_date=data.installation_date,
            capacity_max=data.capacity_max,
            capacity_min=data.capacity_min,
            graduation=data.graduation,
            status=data.status,
            notes=data.notes,
        )
        db.add(equipment)
        db.commit()
        db.refresh(equipment)
        return equipment

    @staticmethod
    def get_equipments(
        db: Session,
        customer_id: Optional[int] = None,
        equipment_type: Optional[str] = None,
        equipment_status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Equipment]:
        query = db.query(Equipment).options(joinedload(Equipment.customer))

        if customer_id:
            query = query.filter(Equipment.customer_id == customer_id)
        if equipment_type:
            try:
                eq_type = EquipmentType(equipment_type)
                query = query.filter(Equipment.equipment_type == eq_type)
            except ValueError:
                pass
        if equipment_status:
            try:
                eq_status = EquipmentStatus(equipment_status)
                query = query.filter(Equipment.status == eq_status)
            except ValueError:
                pass
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Equipment.equipment_code.ilike(search_filter),
                    Equipment.designation.ilike(search_filter),
                    Equipment.brand.ilike(search_filter),
                    Equipment.model.ilike(search_filter),
                    Equipment.serial_number.ilike(search_filter),
                    Equipment.site_name.ilike(search_filter),
                    Equipment.city.ilike(search_filter),
                )
            )

        return query.order_by(Equipment.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_equipment_by_id(db: Session, equipment_id: int) -> Equipment:
        equipment = (
            db.query(Equipment)
            .options(
                joinedload(Equipment.customer),
                selectinload(Equipment.interventions),
            )
            .filter(Equipment.id == equipment_id)
            .first()
        )
        if not equipment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Equipment with ID {equipment_id} not found",
            )
        return equipment

    @staticmethod
    def update_equipment(db: Session, equipment_id: int, data: EquipmentUpdate) -> Equipment:
        equipment = EquipmentService.get_equipment_by_id(db, equipment_id)

        update_data = data.model_dump(exclude_unset=True)
        if "customer_id" in update_data and update_data["customer_id"] is not None:
            customer = db.query(BusinessPartner).filter(BusinessPartner.id == update_data["customer_id"]).first()
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Customer with ID {update_data['customer_id']} not found",
                )

        for key, value in update_data.items():
            setattr(equipment, key, value)

        db.commit()
        db.refresh(equipment)
        return equipment

    @staticmethod
    def delete_equipment(db: Session, equipment_id: int) -> bool:
        equipment = EquipmentService.get_equipment_by_id(db, equipment_id)
        db.delete(equipment)
        db.commit()
        return True

    @staticmethod
    def get_equipment_history(db: Session, equipment_id: int) -> List[Intervention]:
        EquipmentService.get_equipment_by_id(db, equipment_id)
        return (
            db.query(Intervention)
            .options(
                joinedload(Intervention.customer),
                joinedload(Intervention.technician),
                selectinload(Intervention.tasks),
                selectinload(Intervention.parts),
            )
            .filter(Intervention.equipment_id == equipment_id)
            .order_by(Intervention.date_start.desc())
            .all()
        )


class InterventionService:
    @staticmethod
    def generate_intervention_code(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        prefix = f"INT-{current_year}-"
        count = (
            db.query(func.count(Intervention.id))
            .filter(Intervention.intervention_code.like(f"{prefix}%"))
            .scalar()
            or 0
        )
        return f"{prefix}{count + 1:04d}"

    @staticmethod
    def create_intervention(db: Session, user_id: int, data: InterventionCreate) -> Intervention:
        # Validate customer
        customer = db.query(BusinessPartner).filter(BusinessPartner.id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID {data.customer_id} not found",
            )

        # Validate equipment if provided
        if data.equipment_id:
            equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
            if not equipment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Equipment with ID {data.equipment_id} not found",
                )

        # Validate technician if provided
        if data.assigned_technician_id:
            technician = db.query(Employee).filter(Employee.id == data.assigned_technician_id).first()
            if not technician:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Technician / Employee with ID {data.assigned_technician_id} not found",
                )

        code = data.intervention_code or InterventionService.generate_intervention_code(db)
        existing = db.query(Intervention).filter(Intervention.intervention_code == code).first()
        if existing:
            code = InterventionService.generate_intervention_code(db)

        # Calculate parts cost from parts payload if present
        parts_cost = float(data.parts_cost or 0.0)
        calculated_parts_cost = 0.0
        parts_to_create = []

        if data.parts:
            for p in data.parts:
                qty = float(p.quantity or 1.0)
                price = float(p.unit_price or 0.0)
                tax = float(p.tax_rate or 20.0)
                tot_ht = round(qty * price, 2)
                tot_ttc = round(tot_ht * (1.0 + tax / 100.0), 2)
                calculated_parts_cost += tot_ht
                parts_to_create.append(
                    InterventionPart(
                        product_id=p.product_id,
                        designation=p.designation,
                        quantity=qty,
                        unit_price=price,
                        tax_rate=tax,
                        total_ht=tot_ht,
                        total_ttc=tot_ttc,
                    )
                )
            parts_cost = calculated_parts_cost

        labor_cost = float(data.labor_cost or 0.0)
        travel_cost = float(data.travel_cost or 0.0)
        other_cost = float(data.other_cost or 0.0)
        total_cost = round(labor_cost + parts_cost + travel_cost + other_cost, 2)

        intervention = Intervention(
            intervention_code=code,
            customer_id=data.customer_id,
            equipment_id=data.equipment_id,
            site=data.site,
            assigned_technician_id=data.assigned_technician_id,
            date_start=data.date_start or datetime.now(timezone.utc),
            date_end=data.date_end,
            intervention_type=data.intervention_type,
            priority=data.priority,
            status=data.status,
            problem_description=data.problem_description,
            diagnosis=data.diagnosis,
            work_performed=data.work_performed,
            observations=data.observations,
            recommendations=data.recommendations,
            next_maintenance_date=data.next_maintenance_date,
            next_maintenance_mileage=data.next_maintenance_mileage,
            labor_cost=labor_cost,
            parts_cost=parts_cost,
            travel_cost=travel_cost,
            other_cost=other_cost,
            total_cost=total_cost,
            quote_id=data.quote_id,
            sale_id=data.sale_id,
            invoice_id=data.invoice_id,
            created_by=user_id,
            notes=data.notes,
        )

        db.add(intervention)
        db.flush()

        # Add tasks
        if data.tasks:
            for idx, t in enumerate(data.tasks):
                task = InterventionTask(
                    intervention_id=intervention.id,
                    description=t.description,
                    status=t.status or TaskStatus.PENDING,
                    notes=t.notes,
                    completed_at=t.completed_at,
                    order_index=t.order_index if t.order_index is not None else idx,
                )
                db.add(task)

        # Add parts
        for part in parts_to_create:
            part.intervention_id = intervention.id
            db.add(part)

        db.commit()
        return InterventionService.get_intervention_by_id(db, intervention.id)

    @staticmethod
    def get_interventions(
        db: Session,
        customer_id: Optional[int] = None,
        equipment_id: Optional[int] = None,
        technician_id: Optional[int] = None,
        intervention_type: Optional[str] = None,
        intervention_status: Optional[str] = None,
        priority: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        year: Optional[int] = None,
        month: Optional[int] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Intervention]:
        query = db.query(Intervention).options(
            joinedload(Intervention.customer),
            joinedload(Intervention.equipment),
            joinedload(Intervention.technician),
            selectinload(Intervention.tasks),
            selectinload(Intervention.parts).joinedload(InterventionPart.product),
        )

        if customer_id:
            query = query.filter(Intervention.customer_id == customer_id)
        if equipment_id:
            query = query.filter(Intervention.equipment_id == equipment_id)
        if technician_id:
            query = query.filter(Intervention.assigned_technician_id == technician_id)
        if intervention_type:
            try:
                it_type = InterventionType(intervention_type)
                query = query.filter(Intervention.intervention_type == it_type)
            except ValueError:
                pass
        if intervention_status:
            try:
                it_status = InterventionStatus(intervention_status)
                query = query.filter(Intervention.status == it_status)
            except ValueError:
                pass
        if priority:
            try:
                it_prio = InterventionPriority(priority)
                query = query.filter(Intervention.priority == it_prio)
            except ValueError:
                pass

        if date_from:
            query = query.filter(Intervention.date_start >= date_from)
        if date_to:
            query = query.filter(Intervention.date_start <= date_to)

        if year:
            query = query.filter(extract("year", Intervention.date_start) == year)
        if month:
            query = query.filter(extract("month", Intervention.date_start) == month)

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Intervention.intervention_code.ilike(search_filter),
                    Intervention.site.ilike(search_filter),
                    Intervention.problem_description.ilike(search_filter),
                    Intervention.diagnosis.ilike(search_filter),
                    Intervention.work_performed.ilike(search_filter),
                )
            )

        return query.order_by(Intervention.date_start.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_intervention_by_id(db: Session, intervention_id: int) -> Intervention:
        intervention = (
            db.query(Intervention)
            .options(
                joinedload(Intervention.customer),
                joinedload(Intervention.equipment),
                joinedload(Intervention.technician),
                joinedload(Intervention.creator),
                selectinload(Intervention.tasks),
                selectinload(Intervention.parts).joinedload(InterventionPart.product),
            )
            .filter(Intervention.id == intervention_id)
            .first()
        )
        if not intervention:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Intervention with ID {intervention_id} not found",
            )
        return intervention

    @staticmethod
    def recalculate_intervention_costs(db: Session, intervention: Intervention) -> None:
        parts_total = sum(float(p.total_ht or 0.0) for p in intervention.parts)
        intervention.parts_cost = round(parts_total, 2)
        intervention.total_cost = round(
            float(intervention.labor_cost or 0.0)
            + intervention.parts_cost
            + float(intervention.travel_cost or 0.0)
            + float(intervention.other_cost or 0.0),
            2,
        )

    @staticmethod
    def update_intervention(db: Session, intervention_id: int, data: InterventionUpdate) -> Intervention:
        intervention = InterventionService.get_intervention_by_id(db, intervention_id)

        update_data = data.model_dump(exclude_unset=True)
        tasks_data = update_data.pop("tasks", None)
        parts_data = update_data.pop("parts", None)

        if "customer_id" in update_data and update_data["customer_id"] is not None:
            customer = db.query(BusinessPartner).filter(BusinessPartner.id == update_data["customer_id"]).first()
            if not customer:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        if "equipment_id" in update_data and update_data["equipment_id"] is not None:
            equipment = db.query(Equipment).filter(Equipment.id == update_data["equipment_id"]).first()
            if not equipment:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")

        if "assigned_technician_id" in update_data and update_data["assigned_technician_id"] is not None:
            technician = db.query(Employee).filter(Employee.id == update_data["assigned_technician_id"]).first()
            if not technician:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

        for key, value in update_data.items():
            setattr(intervention, key, value)

        # Handle tasks replacement if provided
        if tasks_data is not None:
            intervention.tasks.clear()
            for idx, t in enumerate(tasks_data):
                task = InterventionTask(
                    intervention_id=intervention.id,
                    description=t["description"],
                    status=t.get("status", TaskStatus.PENDING),
                    notes=t.get("notes"),
                    completed_at=t.get("completed_at"),
                    order_index=t.get("order_index", idx),
                )
                db.add(task)

        # Handle parts replacement if provided
        if parts_data is not None:
            intervention.parts.clear()
            for p in parts_data:
                qty = float(p.get("quantity", 1.0))
                price = float(p.get("unit_price", 0.0))
                tax = float(p.get("tax_rate", 20.0))
                tot_ht = round(qty * price, 2)
                tot_ttc = round(tot_ht * (1.0 + tax / 100.0), 2)
                part = InterventionPart(
                    intervention_id=intervention.id,
                    product_id=p.get("product_id"),
                    designation=p["designation"],
                    quantity=qty,
                    unit_price=price,
                    tax_rate=tax,
                    total_ht=tot_ht,
                    total_ttc=tot_ttc,
                )
                db.add(part)

        InterventionService.recalculate_intervention_costs(db, intervention)
        db.commit()
        db.refresh(intervention)
        return InterventionService.get_intervention_by_id(db, intervention.id)

    @staticmethod
    def update_intervention_status(
        db: Session, intervention_id: int, data: InterventionStatusUpdate
    ) -> Intervention:
        intervention = InterventionService.get_intervention_by_id(db, intervention_id)
        intervention.status = data.status
        if data.date_end is not None:
            intervention.date_end = data.date_end
        elif data.status == InterventionStatus.COMPLETED and not intervention.date_end:
            intervention.date_end = datetime.now(timezone.utc)

        if data.observations is not None:
            intervention.observations = data.observations
        if data.work_performed is not None:
            intervention.work_performed = data.work_performed

        db.commit()
        db.refresh(intervention)
        return InterventionService.get_intervention_by_id(db, intervention.id)

    @staticmethod
    def delete_intervention(db: Session, intervention_id: int) -> bool:
        intervention = InterventionService.get_intervention_by_id(db, intervention_id)
        db.delete(intervention)
        db.commit()
        return True

    # ----------------------------------------------------
    # TASK OPERATIONS
    # ----------------------------------------------------
    @staticmethod
    def add_task(db: Session, intervention_id: int, data: InterventionTaskCreate) -> InterventionTask:
        intervention = InterventionService.get_intervention_by_id(db, intervention_id)
        task = InterventionTask(
            intervention_id=intervention.id,
            description=data.description,
            status=data.status,
            notes=data.notes,
            completed_at=data.completed_at,
            order_index=data.order_index,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def update_task(db: Session, task_id: int, data: InterventionTaskUpdate) -> InterventionTask:
        task = db.query(InterventionTask).filter(InterventionTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(task, key, value)

        if task.status == TaskStatus.COMPLETED and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def delete_task(db: Session, task_id: int) -> bool:
        task = db.query(InterventionTask).filter(InterventionTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        db.delete(task)
        db.commit()
        return True

    # ----------------------------------------------------
    # PART OPERATIONS
    # ----------------------------------------------------
    @staticmethod
    def add_part(db: Session, intervention_id: int, data: InterventionPartCreate) -> InterventionPart:
        intervention = InterventionService.get_intervention_by_id(db, intervention_id)

        qty = float(data.quantity or 1.0)
        price = float(data.unit_price or 0.0)
        tax = float(data.tax_rate or 20.0)
        tot_ht = round(qty * price, 2)
        tot_ttc = round(tot_ht * (1.0 + tax / 100.0), 2)

        part = InterventionPart(
            intervention_id=intervention.id,
            product_id=data.product_id,
            designation=data.designation,
            quantity=qty,
            unit_price=price,
            tax_rate=tax,
            total_ht=tot_ht,
            total_ttc=tot_ttc,
        )
        db.add(part)
        db.flush()

        InterventionService.recalculate_intervention_costs(db, intervention)
        db.commit()
        db.refresh(part)
        return part

    @staticmethod
    def update_part(db: Session, part_id: int, data: InterventionPartUpdate) -> InterventionPart:
        part = db.query(InterventionPart).filter(InterventionPart.id == part_id).first()
        if not part:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(part, key, value)

        qty = float(part.quantity or 1.0)
        price = float(part.unit_price or 0.0)
        tax = float(part.tax_rate or 20.0)
        part.total_ht = round(qty * price, 2)
        part.total_ttc = round(part.total_ht * (1.0 + tax / 100.0), 2)

        intervention = InterventionService.get_intervention_by_id(db, part.intervention_id)
        InterventionService.recalculate_intervention_costs(db, intervention)

        db.commit()
        db.refresh(part)
        return part

    @staticmethod
    def delete_part(db: Session, part_id: int) -> bool:
        part = db.query(InterventionPart).filter(InterventionPart.id == part_id).first()
        if not part:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")
        intervention_id = part.intervention_id
        db.delete(part)
        db.flush()

        intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
        if intervention:
            InterventionService.recalculate_intervention_costs(db, intervention)

        db.commit()
        return True

    # ----------------------------------------------------
    # MAINTENANCE STATS
    # ----------------------------------------------------
    @staticmethod
    def get_maintenance_stats(
        db: Session, year: Optional[int] = None, month: Optional[int] = None
    ) -> MaintenanceStatsResponse:
        now = datetime.now(timezone.utc)
        current_year = year or now.year
        current_month = month or now.month

        # Interventions in selected month
        month_query = db.query(Intervention).filter(
            extract("year", Intervention.date_start) == current_year,
            extract("month", Intervention.date_start) == current_month,
        )
        interventions_month = month_query.count()

        # Monthly total cost
        monthly_cost = db.query(func.coalesce(func.sum(Intervention.total_cost), 0.0)).filter(
            extract("year", Intervention.date_start) == current_year,
            extract("month", Intervention.date_start) == current_month,
        ).scalar() or 0.0

        # Annual total cost
        annual_cost = db.query(func.coalesce(func.sum(Intervention.total_cost), 0.0)).filter(
            extract("year", Intervention.date_start) == current_year,
        ).scalar() or 0.0

        # Status counts across all
        in_progress_count = db.query(Intervention).filter(Intervention.status == InterventionStatus.IN_PROGRESS).count()
        completed_count = db.query(Intervention).filter(Intervention.status == InterventionStatus.COMPLETED).count()
        scheduled_count = db.query(Intervention).filter(Intervention.status == InterventionStatus.SCHEDULED).count()
        urgent_count = db.query(Intervention).filter(
            Intervention.priority.in_([InterventionPriority.HIGH, InterventionPriority.CRITICAL]),
            Intervention.status.notin_([InterventionStatus.COMPLETED, InterventionStatus.CANCELLED]),
        ).count()

        # Equipment count
        equipment_count = db.query(Equipment).count()

        # Upcoming maintenance approaching (within next 30 days)
        thirty_days_ahead = now + timedelta(days=30)
        upcoming_count = db.query(Intervention).filter(
            Intervention.next_maintenance_date.isnot(None),
            Intervention.next_maintenance_date >= now,
            Intervention.next_maintenance_date <= thirty_days_ahead,
        ).count()

        return MaintenanceStatsResponse(
            interventions_month=interventions_month,
            in_progress_count=in_progress_count,
            completed_count=completed_count,
            urgent_count=urgent_count,
            scheduled_count=scheduled_count,
            equipment_count=equipment_count,
            monthly_cost=round(float(monthly_cost), 2),
            annual_cost=round(float(annual_cost), 2),
            upcoming_maintenance_equipment_count=upcoming_count,
        )
