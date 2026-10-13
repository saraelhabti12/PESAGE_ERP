from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.report_schemas import (
    CommercialReportResponse,
    CommercialReportsBundle,
    CommercialStatistics,
)
from app.security.deps import require_permission
from app.services.statistics_services import CommercialStatisticsService

router = APIRouter(prefix="/reports", tags=["Reports & Commercial Statistics"])


@router.get(
    "/commercial",
    response_model=CommercialReportResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("dashboard.view"))],
)
def get_commercial_report(
    date_from: Optional[datetime] = Query(None, alias="period_start"),
    date_to: Optional[datetime] = Query(None, alias="period_end"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("dashboard.view")),
):
    """Retrieves full commercial report (KPIs, monthly margins, top customers, top products)."""
    return CommercialStatisticsService.get_commercial_report(db=db, date_from=date_from, date_to=date_to)


@router.get(
    "/commercial-statistics",
    response_model=CommercialStatistics,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("dashboard.view"))],
)
def get_commercial_statistics(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    customer_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("dashboard.view")),
):
    """Calculates real-time commercial KPIs aggregated from PostgreSQL."""
    return CommercialStatisticsService.get_commercial_statistics(
        db=db,
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        supplier_id=supplier_id,
    )


@router.get(
    "/commercial-bundle",
    response_model=CommercialReportsBundle,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("dashboard.view"))],
)
def get_commercial_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("dashboard.view")),
):
    """Retrieves full commercial reports bundle: monthly trends, top customers, top suppliers, overdue list."""
    return CommercialStatisticsService.get_commercial_reports(db=db)
