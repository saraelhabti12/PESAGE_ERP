from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log_model import AuditLog
from app.models.user_model import User


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        entity_type: str,
        entity_id: int,
        action: str,
        user_id: Optional[int] = None,
        user_email: Optional[str] = None,
        summary: Optional[str] = None,
        details: Optional[Dict[str, Any] | str] = None,
    ) -> AuditLog:
        """Records an audit trail entry."""
        if user_id and not user_email:
            u = db.query(User).filter(User.id == user_id).first()
            if u:
                user_email = u.email

        details_str = json.dumps(details, default=str) if isinstance(details, (dict, list)) else details

        log = AuditLog(
            entity_type=entity_type.upper(),
            entity_id=entity_id,
            action=action.upper(),
            user_id=user_id,
            user_email=user_email,
            summary=summary,
            details=details_str,
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def list_logs(
        db: Session,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        action: Optional[str] = None,
        user_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[AuditLog], int]:
        query = db.query(AuditLog).options(selectinload(AuditLog.user))

        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type.upper())

        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)

        if action:
            query = query.filter(AuditLog.action == action.upper())

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        if date_from:
            query = query.filter(AuditLog.created_at >= date_from)

        if date_to:
            query = query.filter(AuditLog.created_at <= date_to)

        total = query.count()
        items = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(skip).limit(limit).all()
        return items, total
