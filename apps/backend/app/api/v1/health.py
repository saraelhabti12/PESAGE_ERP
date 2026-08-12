from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.db.database import check_db_connection

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Returns application health status."""
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "version": settings.APP_VERSION,
    }


@router.get("/health/db", status_code=status.HTTP_200_OK)
def db_health_check():
    """Verifies that the PostgreSQL database is reachable."""
    is_connected = check_db_connection()
    if not is_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "database": "disconnected",
                "message": "Unable to connect to PostgreSQL database",
            },
        )
    return {
        "status": "ok",
        "database": "connected",
    }
