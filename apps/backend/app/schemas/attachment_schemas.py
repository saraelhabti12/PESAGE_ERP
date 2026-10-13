from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AttachmentBase(BaseModel):
    entity_type: str
    entity_id: int
    category: Optional[str] = None
    description: Optional[str] = None


class AttachmentRead(AttachmentBase):
    id: int
    filename: str
    original_filename: Optional[str] = None
    file_type: str
    content_type: Optional[str] = None
    file_size: int
    uploaded_by: Optional[int] = None
    uploader_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

