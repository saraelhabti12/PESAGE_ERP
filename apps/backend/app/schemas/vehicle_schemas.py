from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.vehicle_model import FuelType, MaintenanceType, VehicleStatus
from app.schemas.employee_schemas import EmployeeRead
from app.schemas.sale_schemas import UserSummary


# --------------------------------------------------
# Vehicle Maintenance Schemas
# --------------------------------------------------
class VehicleMaintenanceBase(BaseModel):
    vehicle_id: int
    maintenance_date: Optional[datetime] = None
    mileage: float = Field(default=0.0, ge=0)
    maintenance_type: MaintenanceType = Field(default=MaintenanceType.OIL_CHANGE)
    description: str = Field(..., max_length=255)
    supplier: Optional[str] = Field(None, max_length=255)
    labor_cost: float = Field(default=0.0, ge=0)
    parts_cost: float = Field(default=0.0, ge=0)
    next_maintenance_date: Optional[datetime] = None
    next_maintenance_mileage: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_maintenance_input(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Clean empty date strings
            if data.get("maintenance_date") == "":
                data["maintenance_date"] = None
            if data.get("next_maintenance_date") == "":
                data["next_maintenance_date"] = None

            # Map field aliases
            if "mileage_at_maintenance" in data and ("mileage" not in data or data["mileage"] is None):
                data["mileage"] = data["mileage_at_maintenance"]
            if "service_provider" in data and ("supplier" not in data or data["supplier"] is None):
                data["supplier"] = data["service_provider"]

            # Map maintenance type string
            if "maintenance_type" in data and isinstance(data["maintenance_type"], str):
                mt_raw = data["maintenance_type"].upper()
                if "VIDANGE" in mt_raw or "OIL" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.OIL_CHANGE
                elif "REVISION" in mt_raw or "RÉVISION" in mt_raw or "INSPECT" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.INSPECTION
                elif "FREIN" in mt_raw or "BRAKE" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.BRAKES
                elif "PNEU" in mt_raw or "TIRE" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.TIRES
                elif "BATTERI" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.BATTERY
                elif "MOTEUR" in mt_raw or "ENGINE" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.ENGINE
                elif "CLIM" in mt_raw or "AC" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.AC
                elif "TECHNIQUE" in mt_raw or "CHECK" in mt_raw or "VISITE" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.CHECK
                elif "REPAIR" in mt_raw or "RÉPARATION" in mt_raw:
                    data["maintenance_type"] = MaintenanceType.REPAIR
                else:
                    data["maintenance_type"] = MaintenanceType.OTHER
        return data


class VehicleMaintenanceCreate(VehicleMaintenanceBase):
    pass


class VehicleMaintenanceRead(VehicleMaintenanceBase):
    id: int
    total_cost: float
    created_by: int
    created_at: datetime
    creator: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Fuel Log Schemas
# --------------------------------------------------
class FuelLogBase(BaseModel):
    vehicle_id: int
    date: Optional[datetime] = None
    mileage: float = Field(default=0.0, ge=0)
    liters: float = Field(default=0.0, ge=0)
    price_per_liter: float = Field(default=0.0, ge=0)
    station: Optional[str] = Field(None, max_length=255)
    driver_id: Optional[int] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fuel_input(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("date") == "":
                data["date"] = None
            if "quantity_liters" in data and ("liters" not in data or data["liters"] is None):
                data["liters"] = data["quantity_liters"]
            if "station_name" in data and ("station" not in data or data["station"] is None):
                data["station"] = data["station_name"]
        return data


class FuelLogCreate(FuelLogBase):
    pass


class FuelLogRead(FuelLogBase):
    id: int
    total_cost: float
    created_by: int
    created_at: datetime
    driver: Optional[EmployeeRead] = None
    creator: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Vehicle Schemas
# --------------------------------------------------
class VehicleBase(BaseModel):
    registration_number: str = Field(..., max_length=50)
    brand: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    vehicle_type: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = None
    vin: Optional[str] = Field(None, max_length=100)
    first_registration_date: Optional[datetime] = None
    current_mileage: float = Field(default=0.0, ge=0)
    fuel_type: FuelType = Field(default=FuelType.DIESEL)
    fuel_capacity: Optional[float] = None
    status: VehicleStatus = Field(default=VehicleStatus.ACTIVE)
    default_driver_id: Optional[int] = None

    insurance_expiry: Optional[datetime] = None
    technical_inspection_expiry: Optional[datetime] = None
    registration_expiry: Optional[datetime] = None
    tax_expiry: Optional[datetime] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def clean_and_normalize_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Clean empty strings for dates
            date_fields = [
                "insurance_expiry",
                "technical_inspection_expiry",
                "first_registration_date",
                "registration_expiry",
                "tax_expiry",
            ]
            for key in date_fields:
                if key in data and (data[key] == "" or data[key] is None):
                    data[key] = None

            # Driver mapping
            if "driver_id" in data and ("default_driver_id" not in data or data.get("default_driver_id") is None):
                data["default_driver_id"] = data["driver_id"] or None
            if data.get("default_driver_id") == "" or data.get("default_driver_id") == 0:
                data["default_driver_id"] = None

            # Mileage mapping
            if "mileage" in data and ("current_mileage" not in data or data.get("current_mileage") is None):
                data["current_mileage"] = data["mileage"] or 0.0

            # Fuel type normalization
            if "fuel_type" in data and isinstance(data["fuel_type"], str):
                ft = data["fuel_type"].strip().upper()
                if "DIESEL" in ft or "GAZOLE" in ft:
                    data["fuel_type"] = FuelType.DIESEL
                elif "ESSENCE" in ft or "GASOLINE" in ft:
                    data["fuel_type"] = FuelType.GASOLINE
                elif "HYBRID" in ft or "HYBRIDE" in ft:
                    data["fuel_type"] = FuelType.HYBRID
                elif "ELECT" in ft or "ÉLECT" in ft:
                    data["fuel_type"] = FuelType.ELECTRIC
                else:
                    data["fuel_type"] = FuelType.DIESEL

            # Status normalization
            if "status" in data and isinstance(data["status"], str):
                st = data["status"].strip().upper()
                if st in ["AVAILABLE", "ACTIVE", "DISPONIBLE", "EN SERVICE"]:
                    data["status"] = VehicleStatus.ACTIVE
                elif st in ["IN_USE", "IN_SERVICE", "EN MISSION"]:
                    data["status"] = VehicleStatus.IN_SERVICE
                elif st in ["MAINTENANCE", "EN MAINTENANCE", "RÉPARATION"]:
                    data["status"] = VehicleStatus.MAINTENANCE
                elif st in ["OUT_OF_SERVICE", "DECOMMISSIONED", "HORS SERVICE", "RÉFORMÉ"]:
                    data["status"] = VehicleStatus.DECOMMISSIONED
                else:
                    data["status"] = VehicleStatus.ACTIVE
        return data


class VehicleCreate(VehicleBase):
    vehicle_code: Optional[str] = Field(None, max_length=50)


class VehicleUpdate(BaseModel):
    registration_number: Optional[str] = Field(None, max_length=50)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    first_registration_date: Optional[datetime] = None
    current_mileage: Optional[float] = None
    fuel_type: Optional[FuelType] = None
    fuel_capacity: Optional[float] = None
    status: Optional[VehicleStatus] = None
    default_driver_id: Optional[int] = None
    insurance_expiry: Optional[datetime] = None
    technical_inspection_expiry: Optional[datetime] = None
    registration_expiry: Optional[datetime] = None
    tax_expiry: Optional[datetime] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def clean_update_inputs(cls, data: Any) -> Any:
        return VehicleBase.clean_and_normalize_inputs(data)


class VehicleRead(VehicleBase):
    id: int
    vehicle_code: str
    created_at: datetime
    updated_at: datetime
    default_driver: Optional[EmployeeRead] = None
    maintenances: List[VehicleMaintenanceRead] = []
    fuel_logs: List[FuelLogRead] = []

    @computed_field
    @property
    def code(self) -> str:
        return self.vehicle_code

    @computed_field
    @property
    def driver(self) -> Optional[EmployeeRead]:
        return self.default_driver

    @computed_field
    @property
    def driver_id(self) -> Optional[int]:
        return self.default_driver_id

    @computed_field
    @property
    def mileage(self) -> float:
        return self.current_mileage

    model_config = ConfigDict(from_attributes=True)


class VehicleStatistics(BaseModel):
    fuel_cost_month: float
    maintenance_cost_month: float
    fuel_cost_year: float
    maintenance_cost_year: float
    total_vehicle_expenses: float
    total_kilometers: float
    cost_per_km: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
