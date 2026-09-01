from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PermissionResponse(BaseModel):
    id: int
    module: str
    action: str
    code: str
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
