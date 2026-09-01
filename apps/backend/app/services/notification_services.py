from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.notification_model import Notification, NotificationType


class NotificationService:
    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: int,
        limit: int = 50,
        unread_only: bool = False,
    ) -> List[Notification]:
        """Fetches notifications for a specific user or broadcast notifications."""
        query = db.query(Notification).filter(
            or_(Notification.user_id == user_id, Notification.user_id.is_(None))
        )
        if unread_only:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()

    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        """Returns the number of unread notifications for a user."""
        return (
            db.query(Notification)
            .filter(
                or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
                Notification.is_read.is_(False),
            )
            .count()
        )

    @staticmethod
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
        """Marks a notification as read."""
        notif = (
            db.query(Notification)
            .filter(
                Notification.id == notification_id,
                or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
            )
            .first()
        )
        if notif:
            notif.is_read = True
            db.commit()
            db.refresh(notif)
        return notif

    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        """Marks all unread notifications for a user as read."""
        updated = (
            db.query(Notification)
            .filter(
                or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
                Notification.is_read.is_(False),
            )
            .update({"is_read": True}, synchronize_session=False)
        )
        db.commit()
        return updated

    @staticmethod
    def create_notification(
        db: Session,
        title: str,
        message: str,
        type: NotificationType = NotificationType.INFO,
        user_id: Optional[int] = None,
        link: Optional[str] = None,
    ) -> Notification:
        """Creates and persists a new notification."""
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            link=link,
            is_read=False,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
