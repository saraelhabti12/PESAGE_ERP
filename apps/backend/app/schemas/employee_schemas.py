from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EmployeeBase(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    job_title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    hire_date: Optional[datetime] = None
    is_active: bool = Field(default=True)
    notes: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    employee_code: Optional[str] = Field(None, max_length=50)


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = None
    email: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    hire_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class EmployeeRead(EmployeeBase):
    id: int
    employee_code: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeListResponse(BaseModel):
    items: List[EmployeeRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
