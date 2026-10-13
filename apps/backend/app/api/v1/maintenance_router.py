from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.maintenance_schemas import (
    EquipmentCreate,
    EquipmentResponse,
    EquipmentUpdate,
    InterventionCreate,
    InterventionPartCreate,
    InterventionPartResponse,
    InterventionPartUpdate,
    InterventionResponse,
    InterventionStatusUpdate,
    InterventionTaskCreate,
    InterventionTaskResponse,
    InterventionTaskUpdate,
    InterventionUpdate,
    MaintenanceStatsResponse,
)
from app.security.deps import get_current_user
from app.services.maintenance_services import EquipmentService, InterventionService

router = APIRouter(prefix="/maintenance", tags=["Maintenance & Interventions"])


# ----------------------------------------------------
# STATS & PREVIEWS (Static routes declared first)
# ----------------------------------------------------
@router.get(
    "/stats",
    response_model=MaintenanceStatsResponse,
    status_code=status.HTTP_200_OK,
)
@router.get(
    "/statistics",
    response_model=MaintenanceStatsResponse,
    status_code=status.HTTP_200_OK,
)
def get_maintenance_stats(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns real business KPI statistics for maintenance operations."""
    return InterventionService.get_maintenance_stats(db=db, year=year, month=month)


@router.get(
    "/next-code",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
def get_next_intervention_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns preview of next intervention code."""
    return {"code": InterventionService.generate_intervention_code(db)}


@router.get(
    "/equipments/next-code",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
def get_next_equipment_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns preview of next equipment code."""
    return {"code": EquipmentService.generate_equipment_code(db)}


# ----------------------------------------------------
# EQUIPMENT ENDPOINTS
# ----------------------------------------------------
@router.get(
    "/equipments",
    response_model=List[EquipmentResponse],
    status_code=status.HTTP_200_OK,
)
def get_equipments(
    customer_id: Optional[int] = Query(None),
    equipment_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List installed customer equipments with optional filters."""
    equipments = EquipmentService.get_equipments(
        db=db,
        customer_id=customer_id,
        equipment_type=equipment_type,
        equipment_status=status,
        search=search,
        skip=skip,
        limit=limit,
    )
    result = []
    for eq in equipments:
        resp = EquipmentResponse.model_validate(eq)
        resp.interventions_count = len(eq.interventions)
        result.append(resp)
    return result


@router.post(
    "/equipments",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_equipment(
    data: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new customer equipment installation."""
    equipment = EquipmentService.create_equipment(db=db, data=data)
    resp = EquipmentResponse.model_validate(equipment)
    resp.interventions_count = 0
    return resp


@router.get(
    "/equipments/{equipment_id}",
    response_model=EquipmentResponse,
    status_code=status.HTTP_200_OK,
)
def get_equipment_by_id(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single equipment details."""
    equipment = EquipmentService.get_equipment_by_id(db=db, equipment_id=equipment_id)
    resp = EquipmentResponse.model_validate(equipment)
    resp.interventions_count = len(equipment.interventions)
    return resp


@router.put(
    "/equipments/{equipment_id}",
    response_model=EquipmentResponse,
    status_code=status.HTTP_200_OK,
)
@router.patch(
    "/equipments/{equipment_id}",
    response_model=EquipmentResponse,
    status_code=status.HTTP_200_OK,
)
def update_equipment(
    equipment_id: int,
    data: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update equipment details."""
    equipment = EquipmentService.update_equipment(db=db, equipment_id=equipment_id, data=data)
    resp = EquipmentResponse.model_validate(equipment)
    resp.interventions_count = len(equipment.interventions)
    return resp


@router.delete(
    "/equipments/{equipment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an equipment."""
    EquipmentService.delete_equipment(db=db, equipment_id=equipment_id)
    return None


@router.get(
    "/equipments/{equipment_id}/history",
    response_model=List[InterventionResponse],
    status_code=status.HTTP_200_OK,
)
def get_equipment_history(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the full chronological intervention history for this equipment."""
    return EquipmentService.get_equipment_history(db=db, equipment_id=equipment_id)


# ----------------------------------------------------
# TASK & PART DIRECT OPERATIONS
# ----------------------------------------------------
@router.put(
    "/tasks/{task_id}",
    response_model=InterventionTaskResponse,
    status_code=status.HTTP_200_OK,
)
@router.patch(
    "/tasks/{task_id}",
    response_model=InterventionTaskResponse,
    status_code=status.HTTP_200_OK,
)
def update_task(
    task_id: int,
    data: InterventionTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update task status, notes, or description."""
    return InterventionService.update_task(db=db, task_id=task_id, data=data)


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a task."""
    InterventionService.delete_task(db=db, task_id=task_id)
    return None


@router.put(
    "/parts/{part_id}",
    response_model=InterventionPartResponse,
    status_code=status.HTTP_200_OK,
)
@router.patch(
    "/parts/{part_id}",
    response_model=InterventionPartResponse,
    status_code=status.HTTP_200_OK,
)
def update_part(
    part_id: int,
    data: InterventionPartUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update used part quantity or price."""
    return InterventionService.update_part(db=db, part_id=part_id, data=data)


@router.delete(
    "/parts/{part_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_part(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a used part."""
    InterventionService.delete_part(db=db, part_id=part_id)
    return None


# ----------------------------------------------------
# INTERVENTION ENDPOINTS
# ----------------------------------------------------
@router.get(
    "",
    response_model=List[InterventionResponse],
    status_code=status.HTTP_200_OK,
)
@router.get(
    "/interventions",
    response_model=List[InterventionResponse],
    status_code=status.HTTP_200_OK,
)
def get_interventions(
    customer_id: Optional[int] = Query(None),
    equipment_id: Optional[int] = Query(None),
    technician_id: Optional[int] = Query(None),
    intervention_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List interventions with extensive filtering options."""
    return InterventionService.get_interventions(
        db=db,
        customer_id=customer_id,
        equipment_id=equipment_id,
        technician_id=technician_id,
        intervention_type=intervention_type,
        intervention_status=status,
        priority=priority,
        date_from=date_from,
        date_to=date_to,
        year=year,
        month=month,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=InterventionResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/interventions",
    response_model=InterventionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_intervention(
    data: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new technical intervention."""
    return InterventionService.create_intervention(
        db=db,
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "/{intervention_id}",
    response_model=InterventionResponse,
    status_code=status.HTTP_200_OK,
)
def get_intervention_by_id(
    intervention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single intervention with tasks and parts."""
    return InterventionService.get_intervention_by_id(db=db, intervention_id=intervention_id)


@router.put(
    "/{intervention_id}",
    response_model=InterventionResponse,
    status_code=status.HTTP_200_OK,
)
def update_intervention(
    intervention_id: int,
    data: InterventionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update intervention details, tasks, parts, or costs."""
    return InterventionService.update_intervention(db=db, intervention_id=intervention_id, data=data)


@router.patch(
    "/{intervention_id}/status",
    response_model=InterventionResponse,
    status_code=status.HTTP_200_OK,
)
def update_intervention_status(
    intervention_id: int,
    data: InterventionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick update intervention status (e.g. mark as COMPLETED)."""
    return InterventionService.update_intervention_status(
        db=db,
        intervention_id=intervention_id,
        data=data,
    )


@router.delete(
    "/{intervention_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_intervention(
    intervention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an intervention."""
    InterventionService.delete_intervention(db=db, intervention_id=intervention_id)
    return None


@router.post(
    "/{intervention_id}/tasks",
    response_model=InterventionTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_task_to_intervention(
    intervention_id: int,
    data: InterventionTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a structured task step to an existing intervention."""
    return InterventionService.add_task(db=db, intervention_id=intervention_id, data=data)


@router.post(
    "/{intervention_id}/parts",
    response_model=InterventionPartResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_part_to_intervention(
    intervention_id: int,
    data: InterventionPartCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a used spare part / consumable to an existing intervention."""
    return InterventionService.add_part(db=db, intervention_id=intervention_id, data=data)
