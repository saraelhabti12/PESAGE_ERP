from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UnitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    abbreviation: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=255)


class UnitUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    abbreviation: Optional[str] = Field(None, min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class UnitResponse(BaseModel):
    id: int
    name: str
    abbreviation: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
