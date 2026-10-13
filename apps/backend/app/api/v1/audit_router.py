from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.audit_schemas import AuditLogRead
from app.security.deps import require_permission
from app.services.audit_services import AuditService

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get(
    "",
    response_model=List[AuditLogRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("audit.view"))],
)
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit.view")),
):
    """Retrieves immutable audit trail history."""
    skip = (page - 1) * size
    items, _ = AuditService.list_logs(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return items
