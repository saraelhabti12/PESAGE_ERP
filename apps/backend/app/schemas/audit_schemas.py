from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

from app.schemas.sale_schemas import UserSummary


class AuditLogRead(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    summary: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
    user: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: List[AuditLogRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
