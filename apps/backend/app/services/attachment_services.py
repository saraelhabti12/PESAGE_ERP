import os
import uuid
import shutil
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from app.models.attachment_model import Attachment

UPLOAD_DIR = Path("uploads/attachments")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class AttachmentService:
    @staticmethod
    def upload_attachment(
        db: Session,
        file: UploadFile,
        entity_type: str,
        entity_id: int,
        category: Optional[str] = None,
        description: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Attachment:
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nom de fichier invalide.",
            )

        # Generate unique storage filename
        original_name = Path(file.filename).name
        ext = Path(original_name).suffix
        safe_unique_name = f"{uuid.uuid4().hex}{ext}"
        target_path = UPLOAD_DIR / safe_unique_name

        # Save to disk
        try:
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_size = target_path.stat().st_size
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erreur lors de l'enregistrement du fichier: {str(e)}",
            )

        content_type = file.content_type or "application/octet-stream"

        attachment = Attachment(
            entity_type=entity_type.upper().strip(),
            entity_id=entity_id,
            filename=original_name,
            stored_filename=safe_unique_name,
            file_path=str(target_path),
            file_type=content_type,
            file_size=file_size,
            category=category.upper().strip() if category else None,
            description=description.strip() if description else None,
            uploaded_by=user_id,
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return attachment

    @staticmethod
    def list_attachments(
        db: Session,
        entity_type: str,
        entity_id: int,
    ) -> List[Attachment]:
        return (
            db.query(Attachment)
            .options(selectinload(Attachment.uploader))
            .filter(
                Attachment.entity_type == entity_type.upper().strip(),
                Attachment.entity_id == entity_id,
            )
            .order_by(Attachment.created_at.desc(), Attachment.id.desc())
            .all()
        )

    @staticmethod
    def get_attachment(db: Session, attachment_id: int) -> Attachment:
        att = (
            db.query(Attachment)
            .options(selectinload(Attachment.uploader))
            .filter(Attachment.id == attachment_id)
            .first()
        )
        if not att:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pièce jointe introuvable.",
            )
        return att

    @staticmethod
    def delete_attachment(db: Session, attachment_id: int) -> None:
        att = AttachmentService.get_attachment(db, attachment_id)
        # Delete file from disk if exists
        try:
            p = Path(att.file_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass

        db.delete(att)
        db.commit()
