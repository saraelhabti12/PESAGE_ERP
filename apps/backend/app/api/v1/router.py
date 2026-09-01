from fastapi import APIRouter

from app.api.v1.auth_router import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.permission_router import router as permission_router
from app.api.v1.role_router import router as role_router
from app.api.v1.user_router import router as user_router
from app.api.v1.category_router import router as category_router
from app.api.v1.product_type_router import router as product_type_router
from app.api.v1.brand_router import router as brand_router
from app.api.v1.unit_router import router as unit_router
from app.api.v1.product_router import router as product_router
from app.api.v1.partner_router import router as partner_router
from app.api.v1.purchase_router import router as purchase_router
from app.api.v1.notification_router import router as notification_router
from app.api.v1.dashboard_router import router as dashboard_router
from app.api.v1.warehouse_router import router as warehouse_router
from app.api.v1.stock_router import router as stock_router
from app.api.v1.inventory_router import router as inventory_router

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
api_router.include_router(notification_router)
api_router.include_router(dashboard_router)
api_router.include_router(warehouse_router)
api_router.include_router(stock_router)
api_router.include_router(inventory_router)

