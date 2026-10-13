from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.models.vehicle_model import FuelType, MaintenanceType, VehicleStatus
from app.schemas.vehicle_schemas import (
    FuelLogCreate,
    FuelLogRead,
    VehicleCreate,
    VehicleMaintenanceCreate,
    VehicleMaintenanceRead,
    VehicleRead,
    VehicleStatistics,
    VehicleUpdate,
)
from app.security.deps import get_current_user, require_permission
from app.services.vehicle_services import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Vehicles & Fleet"])


# ----------------------------------------------------
# Static Endpoints (declared first to prevent dynamic collision)
# ----------------------------------------------------
@router.get(
    "/next-code",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_next_vehicle_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.view")),
):
    """Returns preview of the next automatically generated vehicle code."""
    return {"code": VehicleService.generate_vehicle_code(db)}


@router.get(
    "/stats",
    response_model=VehicleStatistics,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
@router.get(
    "/statistics",
    response_model=VehicleStatistics,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_vehicle_statistics(
    vehicle_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.view")),
):
    """Retrieves real fleet statistics: fuel costs, maintenance costs, mileage, cost per km."""
    return VehicleService.get_vehicle_statistics(db=db, vehicle_id=vehicle_id)


@router.post(
    "/check-expirations",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def check_vehicle_expirations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Triggers verification of expiring vehicle documents and dispatches notifications."""
    return VehicleService.check_and_notify_expiring_documents(db=db)


# ----------------------------------------------------
# Maintenances & Fuel Routes (Static prefix routes before {vehicle_id})
# ----------------------------------------------------
@router.get(
    "/maintenances",
    response_model=List[VehicleMaintenanceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
@router.get(
    "/maintenances/all",
    response_model=List[VehicleMaintenanceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def list_maintenances(
    vehicle_id: Optional[int] = Query(None),
    maintenance_type: Optional[MaintenanceType] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.view")),
):
    """Lists maintenance records across the fleet."""
    skip = (page - 1) * size
    items, _ = VehicleService.list_maintenances(
        db=db,
        vehicle_id=vehicle_id,
        maintenance_type=maintenance_type,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "/maintenances",
    response_model=VehicleMaintenanceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("stock.manage"))],
)
def add_maintenance(
    data: VehicleMaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Records a maintenance or repair intervention."""
    return VehicleService.add_maintenance(db=db, data=data, user_id=current_user.id)


@router.get(
    "/fuel-logs",
    response_model=List[FuelLogRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
@router.get(
    "/fuel/all",
    response_model=List[FuelLogRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
@router.get(
    "/fuel",
    response_model=List[FuelLogRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def list_fuel_logs(
    vehicle_id: Optional[int] = Query(None),
    driver_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.view")),
):
    """Lists fuel logs across the fleet."""
    skip = (page - 1) * size
    items, _ = VehicleService.list_fuel_logs(
        db=db,
        vehicle_id=vehicle_id,
        driver_id=driver_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "/fuel-logs",
    response_model=FuelLogRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("stock.manage"))],
)
@router.post(
    "/fuel",
    response_model=FuelLogRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("stock.manage"))],
)
def add_fuel_log(
    data: FuelLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logs a fuel refueling ticket."""
    return VehicleService.add_fuel_log(db=db, data=data, user_id=current_user.id)


# ----------------------------------------------------
# Collection Endpoints
# ----------------------------------------------------
@router.get(
    "",
    response_model=List[VehicleRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def list_vehicles(
    search: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    status_filter: Optional[VehicleStatus] = Query(None, alias="status"),
    fuel_type: Optional[FuelType] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.view")),
):
    """Lists vehicles with search, status, and fuel type filters."""
    skip = (page - 1) * size
    items, _ = VehicleService.list_vehicles(
        db=db,
        search=search,
        brand=brand,
        status_filter=status_filter,
        fuel_type=fuel_type,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "",
    response_model=VehicleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("stock.manage"))],
)
def create_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registers a new vehicle."""
    return VehicleService.create_vehicle(db=db, data=data)


# ----------------------------------------------------
# Dynamic Parameter Endpoints (Declared AFTER all static routes)
# ----------------------------------------------------
@router.get(
    "/{vehicle_id}",
    response_model=VehicleRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.view")),
):
    """Retrieves a single vehicle with complete maintenance history and fuel logs."""
    return VehicleService.get_vehicle(db=db, vehicle_id=vehicle_id)


@router.put(
    "/{vehicle_id}",
    response_model=VehicleRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.manage"))],
)
def update_vehicle(
    vehicle_id: int,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.manage")),
):
    """Updates vehicle specifications, driver assignment, or document expiry dates."""
    return VehicleService.update_vehicle(db=db, vehicle_id=vehicle_id, data=data)
