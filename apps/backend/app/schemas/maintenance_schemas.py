from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.maintenance_model import (
    EquipmentStatus,
    EquipmentType,
    InterventionPriority,
    InterventionStatus,
    InterventionType,
    TaskStatus,
)


def _sanitize_empty_strings(data: Any) -> Any:
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                v_str = v.strip()
                if v_str == "" and ("date" in k or "_at" in k or k.endswith("_id") or "cost" in k or "capacity" in k or "graduation" in k):
                    cleaned[k] = None
                else:
                    cleaned[k] = v
            elif isinstance(v, dict):
                cleaned[k] = _sanitize_empty_strings(v)
            elif isinstance(v, list):
                cleaned[k] = [_sanitize_empty_strings(item) if isinstance(item, dict) else item for item in v]
            else:
                cleaned[k] = v
        return cleaned
    return data


# ----------------------------------------------------
# EQUIPMENT SCHEMAS
# ----------------------------------------------------
class EquipmentBase(BaseModel):
    equipment_code: Optional[str] = None
    customer_id: int
    designation: str
    equipment_type: EquipmentType = EquipmentType.PONTS_BASCULES
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    site_name: Optional[str] = None
    site_address: Optional[str] = None
    city: Optional[str] = None
    installation_date: Optional[datetime] = None
    capacity_max: Optional[float] = None
    capacity_min: Optional[float] = None
    graduation: Optional[float] = None
    status: EquipmentStatus = EquipmentStatus.OPERATIONAL
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    equipment_code: Optional[str] = None
    customer_id: Optional[int] = None
    designation: Optional[str] = None
    equipment_type: Optional[EquipmentType] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    site_name: Optional[str] = None
    site_address: Optional[str] = None
    city: Optional[str] = None
    installation_date: Optional[datetime] = None
    capacity_max: Optional[float] = None
    capacity_min: Optional[float] = None
    graduation: Optional[float] = None
    status: Optional[EquipmentStatus] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class CustomerMini(BaseModel):
    id: int
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class EquipmentResponse(BaseModel):
    id: int
    equipment_code: str
    customer_id: int
    designation: str
    equipment_type: EquipmentType
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    site_name: Optional[str] = None
    site_address: Optional[str] = None
    city: Optional[str] = None
    installation_date: Optional[datetime] = None
    capacity_max: Optional[float] = None
    capacity_min: Optional[float] = None
    graduation: Optional[float] = None
    status: EquipmentStatus
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerMini] = None
    interventions_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# TASK SCHEMAS
# ----------------------------------------------------
class InterventionTaskBase(BaseModel):
    description: str
    status: TaskStatus = TaskStatus.PENDING
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    order_index: int = 0

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class InterventionTaskCreate(InterventionTaskBase):
    pass


class InterventionTaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    order_index: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class InterventionTaskResponse(BaseModel):
    id: int
    intervention_id: int
    description: str
    status: TaskStatus
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    order_index: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# PART SCHEMAS
# ----------------------------------------------------
class InterventionPartBase(BaseModel):
    product_id: Optional[int] = None
    designation: str
    quantity: float = 1.0
    unit_price: float = 0.0
    tax_rate: float = 20.0
    total_ht: Optional[float] = None
    total_ttc: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class InterventionPartCreate(InterventionPartBase):
    pass


class InterventionPartUpdate(BaseModel):
    product_id: Optional[int] = None
    designation: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    total_ht: Optional[float] = None
    total_ttc: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class ProductMini(BaseModel):
    id: int
    sku: Optional[str] = None
    reference: Optional[str] = None
    designation: Optional[str] = None
    name: Optional[str] = None
    sale_price: Optional[float] = None
    purchase_price: Optional[float] = None
    price: Optional[float] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class InterventionPartResponse(BaseModel):
    id: int
    intervention_id: int
    product_id: Optional[int] = None
    designation: str
    quantity: float
    unit_price: float
    tax_rate: float
    total_ht: float
    total_ttc: float
    created_at: datetime
    product: Optional[ProductMini] = None

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# INTERVENTION SCHEMAS
# ----------------------------------------------------
class TechnicianMini(BaseModel):
    id: int
    first_name: str
    last_name: str
    employee_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class InterventionBase(BaseModel):
    intervention_code: Optional[str] = None
    customer_id: int
    equipment_id: Optional[int] = None
    site: Optional[str] = None
    assigned_technician_id: Optional[int] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    intervention_type: InterventionType = InterventionType.PREVENTIVE_MAINTENANCE
    priority: InterventionPriority = InterventionPriority.NORMAL
    status: InterventionStatus = InterventionStatus.SCHEDULED

    problem_description: Optional[str] = None
    diagnosis: Optional[str] = None
    work_performed: Optional[str] = None
    observations: Optional[str] = None
    recommendations: Optional[str] = None
    next_maintenance_date: Optional[datetime] = None
    next_maintenance_mileage: Optional[float] = None

    labor_cost: float = 0.0
    parts_cost: float = 0.0
    travel_cost: float = 0.0
    other_cost: float = 0.0
    total_cost: Optional[float] = None

    quote_id: Optional[int] = None
    sale_id: Optional[int] = None
    invoice_id: Optional[int] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class InterventionCreate(InterventionBase):
    tasks: Optional[List[InterventionTaskCreate]] = []
    parts: Optional[List[InterventionPartCreate]] = []


class InterventionUpdate(BaseModel):
    customer_id: Optional[int] = None
    equipment_id: Optional[int] = None
    site: Optional[str] = None
    assigned_technician_id: Optional[int] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    intervention_type: Optional[InterventionType] = None
    priority: Optional[InterventionPriority] = None
    status: Optional[InterventionStatus] = None

    problem_description: Optional[str] = None
    diagnosis: Optional[str] = None
    work_performed: Optional[str] = None
    observations: Optional[str] = None
    recommendations: Optional[str] = None
    next_maintenance_date: Optional[datetime] = None
    next_maintenance_mileage: Optional[float] = None

    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    travel_cost: Optional[float] = None
    other_cost: Optional[float] = None
    total_cost: Optional[float] = None

    quote_id: Optional[int] = None
    sale_id: Optional[int] = None
    invoice_id: Optional[int] = None
    notes: Optional[str] = None

    tasks: Optional[List[InterventionTaskCreate]] = None
    parts: Optional[List[InterventionPartCreate]] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        return _sanitize_empty_strings(data)


class InterventionStatusUpdate(BaseModel):
    status: InterventionStatus
    date_end: Optional[datetime] = None
    observations: Optional[str] = None
    work_performed: Optional[str] = None


class InterventionResponse(BaseModel):
    id: int
    intervention_code: str
    customer_id: int
    equipment_id: Optional[int] = None
    site: Optional[str] = None
    assigned_technician_id: Optional[int] = None
    date_start: datetime
    date_end: Optional[datetime] = None
    intervention_type: InterventionType
    priority: InterventionPriority
    status: InterventionStatus

    problem_description: Optional[str] = None
    diagnosis: Optional[str] = None
    work_performed: Optional[str] = None
    observations: Optional[str] = None
    recommendations: Optional[str] = None
    next_maintenance_date: Optional[datetime] = None
    next_maintenance_mileage: Optional[float] = None

    labor_cost: float
    parts_cost: float
    travel_cost: float
    other_cost: float
    total_cost: float

    quote_id: Optional[int] = None
    sale_id: Optional[int] = None
    invoice_id: Optional[int] = None
    notes: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    customer: Optional[CustomerMini] = None
    equipment: Optional[EquipmentResponse] = None
    technician: Optional[TechnicianMini] = None
    tasks: List[InterventionTaskResponse] = []
    parts: List[InterventionPartResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# STATS SCHEMA
# ----------------------------------------------------
class MaintenanceStatsResponse(BaseModel):
    interventions_month: int = 0
    in_progress_count: int = 0
    completed_count: int = 0
    urgent_count: int = 0
    scheduled_count: int = 0
    equipment_count: int = 0
    monthly_cost: float = 0.0
    annual_cost: float = 0.0
    upcoming_maintenance_equipment_count: int = 0
