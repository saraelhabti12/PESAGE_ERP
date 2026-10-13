from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.dashboard_schemas import DashboardStatsResponse
from app.security.deps import get_current_user
from app.services.dashboard_services import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
)
@router.get(
    "/statistics",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves real database-backed metrics and chronological recent activity across all ERP modules."""
    return DashboardService.get_stats(db=db)

