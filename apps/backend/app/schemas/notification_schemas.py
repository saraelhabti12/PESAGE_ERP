from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.notification_model import NotificationType


class NotificationCreate(BaseModel):
    user_id: Optional[int] = None
    title: str
    message: str
    type: NotificationType = NotificationType.INFO
    link: Optional[str] = None


class NotificationRead(BaseModel):
    id: int
    user_id: Optional[int] = None
    title: str
    message: str
    type: NotificationType
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    unread_count: int
