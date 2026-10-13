from fastapi import APIRouter

from app.api.v1.attachment_router import router as attachment_router
from app.api.v1.audit_router import router as audit_router
from app.api.v1.auth_router import router as auth_router
from app.api.v1.brand_router import router as brand_router
from app.api.v1.category_router import router as category_router
from app.api.v1.credit_note_router import router as credit_note_router
from app.api.v1.dashboard_router import router as dashboard_router
from app.api.v1.delivery_note_router import router as delivery_note_router
from app.api.v1.employee_router import router as employee_router
from app.api.v1.expense_router import router as expense_router
from app.api.v1.export_router import router as export_router
from app.api.v1.health import router as health_router
from app.api.v1.inventory_router import router as inventory_router
from app.api.v1.invoice_router import router as invoice_router
from app.api.v1.partner_router import router as partner_router
from app.api.v1.payment_router import router as payment_router
from app.api.v1.permission_router import router as permission_router
from app.api.v1.product_router import router as product_router
from app.api.v1.product_type_router import router as product_type_router
from app.api.v1.purchase_router import router as purchase_router
from app.api.v1.quote_router import router as quote_router
from app.api.v1.report_router import router as report_router
from app.api.v1.role_router import router as role_router
from app.api.v1.sale_router import router as sale_router
from app.api.v1.stock_router import router as stock_router
from app.api.v1.unit_router import router as unit_router
from app.api.v1.user_router import router as user_router
from app.api.v1.vehicle_router import router as vehicle_router
from app.api.v1.warehouse_router import router as warehouse_router
from app.api.v1.notification_router import router as notification_router
from app.api.v1.maintenance_router import router as maintenance_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(role_router)
api_router.include_router(permission_router)
api_router.include_router(category_router)
api_router.include_router(product_type_router)
api_router.include_router(brand_router)
api_router.include_router(unit_router)
api_router.include_router(product_router)
api_router.include_router(partner_router)
api_router.include_router(purchase_router)
api_router.include_router(quote_router)
api_router.include_router(sale_router)
api_router.include_router(delivery_note_router)
api_router.include_router(invoice_router)
api_router.include_router(credit_note_router)
api_router.include_router(payment_router)
api_router.include_router(employee_router)
api_router.include_router(vehicle_router)
api_router.include_router(maintenance_router)
api_router.include_router(expense_router)
api_router.include_router(audit_router)
api_router.include_router(export_router)
api_router.include_router(report_router)
api_router.include_router(notification_router)
api_router.include_router(dashboard_router)
api_router.include_router(warehouse_router)
api_router.include_router(stock_router)
api_router.include_router(inventory_router)
api_router.include_router(attachment_router)

