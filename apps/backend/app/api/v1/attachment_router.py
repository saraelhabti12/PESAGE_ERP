from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.attachment_schemas import AttachmentRead
from app.security.deps import get_current_user
from app.services.attachment_services import AttachmentService

router = APIRouter(prefix="/attachments", tags=["Attachments & Documents"])


@router.get("", response_model=List[AttachmentRead], status_code=status.HTTP_200_OK)
def list_attachments(
    entity_type: str = Query(..., description="Entity type, e.g. CUSTOMER, SUPPLIER, QUOTE, SALE, etc."),
    entity_id: int = Query(..., description="ID of the entity"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List attachments linked to an entity."""
    attachments = AttachmentService.list_attachments(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    result = []
    for att in attachments:
        item = AttachmentRead(
            id=att.id,
            entity_type=att.entity_type,
            entity_id=att.entity_id,
            filename=att.filename,
            original_filename=att.filename,
            file_type=att.file_type,
            content_type=att.file_type,
            file_size=att.file_size,
            category=att.category,
            description=att.description,
            uploaded_by=att.uploaded_by,
            uploader_name=f"{att.uploader.first_name} {att.uploader.last_name}" if att.uploader else None,
            created_at=att.created_at,
        )
        result.append(item)
    return result


@router.post("/upload", response_model=AttachmentRead, status_code=status.HTTP_201_CREATED)
def upload_attachment(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an attachment for any entity."""
    att = AttachmentService.upload_attachment(
        db=db,
        file=file,
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        description=description,
        user_id=current_user.id,
    )
    return AttachmentRead(
        id=att.id,
        entity_type=att.entity_type,
        entity_id=att.entity_id,
        filename=att.filename,
        original_filename=att.filename,
        file_type=att.file_type,
        content_type=att.file_type,
        file_size=att.file_size,
        category=att.category,
        description=att.description,
        uploaded_by=att.uploaded_by,
        uploader_name=f"{current_user.first_name} {current_user.last_name}",
        created_at=att.created_at,
    )


@router.get("/{id}/download")
def download_attachment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download an attachment file."""
    att = AttachmentService.get_attachment(db, id)
    file_path = Path(att.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier physique introuvable sur le serveur.")

    return FileResponse(
        path=str(file_path),
        filename=att.filename,
        media_type=att.file_type,
        headers={"Content-Disposition": f'attachment; filename="{att.filename}"'},
    )


@router.get("/{id}/preview")
def preview_attachment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview an attachment inline (e.g. PDF or image)."""
    att = AttachmentService.get_attachment(db, id)
    file_path = Path(att.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier physique introuvable sur le serveur.")

    return FileResponse(
        path=str(file_path),
        media_type=att.file_type,
        headers={"Content-Disposition": f'inline; filename="{att.filename}"'},
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an attachment."""
    AttachmentService.delete_attachment(db, id)
    return None
