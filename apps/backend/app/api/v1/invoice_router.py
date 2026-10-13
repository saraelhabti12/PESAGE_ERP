from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.invoice_model import InvoiceType
from app.models.user_model import User
from app.schemas.invoice_schemas import (
    InvoiceCreate,
    InvoiceFromPurchaseCreate,
    InvoiceFromSaleCreate,
    InvoiceRead,
    InvoiceUpdate,
)
from app.schemas.sale_schemas import SaleRead
from app.schemas.purchase_schemas import PurchaseOrderRead
from app.security.deps import get_current_user, require_permission
from app.services.invoice_services import InvoiceService

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get(
    "",
    response_model=List[InvoiceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def list_invoices(
    search: Optional[str] = Query(None),
    invoice_type: Optional[InvoiceType] = Query(None),
    customer: Optional[int] = Query(None, alias="customer_id"),
    supplier: Optional[int] = Query(None, alias="supplier_id"),
    sale: Optional[int] = Query(None, alias="sale_id"),
    purchase_order: Optional[int] = Query(None, alias="purchase_order_id"),
    status_filter: Optional[str] = Query(None, alias="status"),
    overdue_only: bool = Query(False),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    payment_method: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Lists invoices with advanced backend filtering (type, customer, supplier, dates, amounts, status)."""
    skip = (page - 1) * size
    invoices, _ = InvoiceService.list_invoices(
        db=db,
        search=search,
        invoice_type=invoice_type,
        customer_id=customer,
        supplier_id=supplier,
        sale_id=sale,
        purchase_order_id=purchase_order,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        payment_method=payment_method,
        overdue_only=overdue_only,
        skip=skip,
        limit=size,
    )
    return invoices


@router.post(
    "",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new invoice (client or supplier)."""
    return InvoiceService.create_invoice(db=db, data=data, user_id=current_user.id)


@router.post(
    "/from-sale",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def create_invoice_from_sale(
    data: InvoiceFromSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates a customer invoice directly from a sales order with calculated due date."""
    return InvoiceService.create_invoice_from_sale(db=db, data=data, user_id=current_user.id)


@router.post(
    "/from-purchase",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def create_invoice_from_purchase(
    data: InvoiceFromPurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates a supplier invoice directly from a purchase order."""
    return InvoiceService.create_invoice_from_purchase_order(db=db, data=data, user_id=current_user.id)


@router.post(
    "/check-overdue",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def check_overdue_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Triggers idempotent check and notification generation for upcoming and overdue invoice payments."""
    return InvoiceService.check_and_notify_due_invoices(db=db)


@router.get(
    "/candidates/sales",
    response_model=List[SaleRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def get_invoiceable_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.create")),
):
    """Retrieves all confirmed/delivered sales eligible for invoice creation."""
    return InvoiceService.get_invoiceable_sales(db=db)


@router.get(
    "/candidates/purchases",
    response_model=List[PurchaseOrderRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def get_invoiceable_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.create")),
):
    """Retrieves all approved/received purchase orders eligible for invoice creation."""
    return InvoiceService.get_invoiceable_purchases(db=db)


@router.get(
    "/{invoice_id}",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Retrieves a single invoice by ID with line items, payments, credit notes, and source documents."""
    return InvoiceService.get_invoice(db=db, invoice_id=invoice_id)


@router.put(
    "/{invoice_id}",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.update"))],
)
def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.update")),
):
    """Updates invoice payment terms, method, due date or notes."""
    return InvoiceService.update_invoice(db=db, invoice_id=invoice_id, data=data)


@router.post(
    "/{invoice_id}/cancel",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.cancel"))],
)
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels an invoice (only if no payments recorded)."""
    return InvoiceService.cancel_invoice(db=db, invoice_id=invoice_id)
