from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.database import SessionLocal
from app.models.permission_model import Permission
from app.models.role_model import Role
from app.models.user_model import User
from app.models.session_model import UserSession  # noqa: F401
import app.models.category_model  # noqa: F401
import app.models.product_type_model  # noqa: F401
import app.models.brand_model  # noqa: F401
import app.models.unit_model  # noqa: F401
import app.models.product_model  # noqa: F401
import app.models.quote_model  # noqa: F401
import app.models.sale_model  # noqa: F401
import app.models.delivery_note_model  # noqa: F401
import app.models.invoice_model  # noqa: F401
import app.models.payment_model  # noqa: F401
from app.security.passwords import hash_password

INITIAL_PERMISSIONS = [
    # Categories
    {"module": "categories", "action": "view", "code": "categories.view", "description": "View categories"},
    {"module": "categories", "action": "create", "code": "categories.create", "description": "Create categories"},
    {"module": "categories", "action": "update", "code": "categories.update", "description": "Update categories"},
    {"module": "categories", "action": "delete", "code": "categories.delete", "description": "Delete categories"},
    # Product Types
    {"module": "product_types", "action": "view", "code": "product_types.view", "description": "View product types"},
    {"module": "product_types", "action": "create", "code": "product_types.create", "description": "Create product types"},
    {"module": "product_types", "action": "update", "code": "product_types.update", "description": "Update product types"},
    {"module": "product_types", "action": "delete", "code": "product_types.delete", "description": "Delete product types"},
    # Brands
    {"module": "brands", "action": "view", "code": "brands.view", "description": "View brands"},
    {"module": "brands", "action": "create", "code": "brands.create", "description": "Create brands"},
    {"module": "brands", "action": "update", "code": "brands.update", "description": "Update brands"},
    {"module": "brands", "action": "delete", "code": "brands.delete", "description": "Delete brands"},
    # Units
    {"module": "units", "action": "view", "code": "units.view", "description": "View units"},
    {"module": "units", "action": "create", "code": "units.create", "description": "Create units"},
    {"module": "units", "action": "update", "code": "units.update", "description": "Update units"},
    {"module": "units", "action": "delete", "code": "units.delete", "description": "Delete units"},
    # Products
    {"module": "products", "action": "view", "code": "products.view", "description": "View products"},
    {"module": "products", "action": "create", "code": "products.create", "description": "Create products"},
    {"module": "products", "action": "update", "code": "products.update", "description": "Update products"},
    {"module": "products", "action": "delete", "code": "products.delete", "description": "Delete products"},
    # Sales
    {"module": "sales", "action": "view", "code": "sales.view", "description": "View sales"},
    {"module": "sales", "action": "create", "code": "sales.create", "description": "Create sales"},
    {"module": "sales", "action": "update", "code": "sales.update", "description": "Update sales"},
    {"module": "sales", "action": "delete", "code": "sales.delete", "description": "Delete sales"},
    {"module": "sales", "action": "confirm", "code": "sales.confirm", "description": "Confirm sales orders"},
    {"module": "sales", "action": "cancel", "code": "sales.cancel", "description": "Cancel sales orders"},
    # Stock
    {"module": "stock", "action": "view", "code": "stock.view", "description": "View stock"},
    {"module": "stock", "action": "adjust", "code": "stock.adjust", "description": "Adjust stock levels"},
    # Warehouses
    {"module": "warehouses", "action": "view", "code": "warehouses.view", "description": "View warehouses"},
    {"module": "warehouses", "action": "create", "code": "warehouses.create", "description": "Create warehouses"},
    {"module": "warehouses", "action": "update", "code": "warehouses.update", "description": "Update warehouses"},
    {"module": "warehouses", "action": "delete", "code": "warehouses.delete", "description": "Delete warehouses"},
    # Stock Movements
    {"module": "stock_movements", "action": "view", "code": "stock_movements.view", "description": "View stock movements"},
    {"module": "stock_movements", "action": "create", "code": "stock_movements.create", "description": "Create stock movements"},
    # Stock Transfers
    {"module": "stock_transfers", "action": "view", "code": "stock_transfers.view", "description": "View stock transfers"},
    {"module": "stock_transfers", "action": "create", "code": "stock_transfers.create", "description": "Create stock transfers"},
    {"module": "stock_transfers", "action": "confirm", "code": "stock_transfers.confirm", "description": "Confirm stock transfers"},
    # Stock Reservations
    {"module": "stock_reservations", "action": "view", "code": "stock_reservations.view", "description": "View stock reservations"},
    {"module": "stock_reservations", "action": "create", "code": "stock_reservations.create", "description": "Create stock reservations"},
    {"module": "stock_reservations", "action": "release", "code": "stock_reservations.release", "description": "Release stock reservations"},
    {"module": "stock_reservations", "action": "consume", "code": "stock_reservations.consume", "description": "Consume stock reservations"},
    # Inventory
    {"module": "inventory", "action": "view", "code": "inventory.view", "description": "View inventory sessions"},
    {"module": "inventory", "action": "create", "code": "inventory.create", "description": "Create inventory sessions"},
    {"module": "inventory", "action": "validate", "code": "inventory.validate", "description": "Validate inventory sessions"},
    {"module": "inventory", "action": "cancel", "code": "inventory.cancel", "description": "Cancel inventory sessions"},
    # Purchases
    {"module": "purchases", "action": "view", "code": "purchases.view", "description": "View purchases"},
    {"module": "purchases", "action": "create", "code": "purchases.create", "description": "Create purchases"},
    {"module": "purchases", "action": "update", "code": "purchases.update", "description": "Update purchases"},
    {"module": "purchases", "action": "delete", "code": "purchases.delete", "description": "Delete purchases"},
    {"module": "purchases", "action": "approve", "code": "purchases.approve", "description": "Approve purchase orders"},
    # Purchase Receipts
    {"module": "purchase_receipts", "action": "view", "code": "purchase_receipts.view", "description": "View purchase receipts"},
    {"module": "purchase_receipts", "action": "create", "code": "purchase_receipts.create", "description": "Create purchase receipts"},
    {"module": "purchase_receipts", "action": "update", "code": "purchase_receipts.update", "description": "Update purchase receipts"},
    {"module": "purchase_receipts", "action": "confirm", "code": "purchase_receipts.confirm", "description": "Confirm purchase receipts"},
    # Quotes (Devis)
    {"module": "quotes", "action": "view", "code": "quotes.view", "description": "View quotes"},
    {"module": "quotes", "action": "create", "code": "quotes.create", "description": "Create quotes"},
    {"module": "quotes", "action": "update", "code": "quotes.update", "description": "Update quotes"},
    {"module": "quotes", "action": "delete", "code": "quotes.delete", "description": "Delete quotes"},
    {"module": "quotes", "action": "send", "code": "quotes.send", "description": "Send quotes to client"},
    {"module": "quotes", "action": "accept", "code": "quotes.accept", "description": "Accept quotes"},
    {"module": "quotes", "action": "reject", "code": "quotes.reject", "description": "Reject quotes"},
    {"module": "quotes", "action": "convert", "code": "quotes.convert", "description": "Convert quotes to sales"},
    # Delivery Notes (Bons de livraison)
    {"module": "delivery_notes", "action": "view", "code": "delivery_notes.view", "description": "View delivery notes"},
    {"module": "delivery_notes", "action": "create", "code": "delivery_notes.create", "description": "Create delivery notes"},
    {"module": "delivery_notes", "action": "update", "code": "delivery_notes.update", "description": "Update delivery notes"},
    {"module": "delivery_notes", "action": "confirm", "code": "delivery_notes.confirm", "description": "Confirm delivery notes"},
    {"module": "delivery_notes", "action": "cancel", "code": "delivery_notes.cancel", "description": "Cancel delivery notes"},
    # Invoices
    {"module": "invoices", "action": "view", "code": "invoices.view", "description": "View invoices"},
    {"module": "invoices", "action": "create", "code": "invoices.create", "description": "Create invoices"},
    {"module": "invoices", "action": "update", "code": "invoices.update", "description": "Update invoices"},
    {"module": "invoices", "action": "delete", "code": "invoices.delete", "description": "Delete invoices"},
    {"module": "invoices", "action": "issue", "code": "invoices.issue", "description": "Issue invoices"},
    {"module": "invoices", "action": "cancel", "code": "invoices.cancel", "description": "Cancel invoices"},
    # Payments
    {"module": "payments", "action": "view", "code": "payments.view", "description": "View payments"},
    {"module": "payments", "action": "create", "code": "payments.create", "description": "Record payments"},
    {"module": "payments", "action": "delete", "code": "payments.delete", "description": "Delete payments"},
    # Tickets
    {"module": "tickets", "action": "view", "code": "tickets.view", "description": "View tickets"},
    {"module": "tickets", "action": "create", "code": "tickets.create", "description": "Create tickets"},
    {"module": "tickets", "action": "update", "code": "tickets.update", "description": "Update tickets"},
    {"module": "tickets", "action": "assign", "code": "tickets.assign", "description": "Assign tickets"},
    {"module": "tickets", "action": "close", "code": "tickets.close", "description": "Close tickets"},
    # Users
    {"module": "users", "action": "view", "code": "users.view", "description": "View users"},
    {"module": "users", "action": "create", "code": "users.create", "description": "Create users"},
    {"module": "users", "action": "update", "code": "users.update", "description": "Update users"},
    {"module": "users", "action": "delete", "code": "users.delete", "description": "Delete users"},
    # Roles
    {"module": "roles", "action": "view", "code": "roles.view", "description": "View roles"},
    {"module": "roles", "action": "create", "code": "roles.create", "description": "Create roles"},
    {"module": "roles", "action": "update", "code": "roles.update", "description": "Update roles"},
    {"module": "roles", "action": "delete", "code": "roles.delete", "description": "Delete roles"},
    # Business Partners
    {"module": "partners", "action": "view", "code": "partners.view", "description": "View business partners"},
    {"module": "partners", "action": "create", "code": "partners.create", "description": "Create business partners"},
    {"module": "partners", "action": "update", "code": "partners.update", "description": "Update business partners"},
    {"module": "partners", "action": "delete", "code": "partners.delete", "description": "Delete business partners"},
    # Customers & Suppliers Views
    {"module": "customers", "action": "view", "code": "customers.view", "description": "View customers"},
    {"module": "suppliers", "action": "view", "code": "suppliers.view", "description": "View suppliers"},
    # Contacts
    {"module": "contacts", "action": "view", "code": "contacts.view", "description": "View partner contacts"},
    {"module": "contacts", "action": "create", "code": "contacts.create", "description": "Create partner contacts"},
    {"module": "contacts", "action": "update", "code": "contacts.update", "description": "Update partner contacts"},
    {"module": "contacts", "action": "delete", "code": "contacts.delete", "description": "Delete partner contacts"},
    # Addresses
    {"module": "addresses", "action": "view", "code": "addresses.view", "description": "View partner addresses"},
    {"module": "addresses", "action": "create", "code": "addresses.create", "description": "Create partner addresses"},
    {"module": "addresses", "action": "update", "code": "addresses.update", "description": "Update partner addresses"},
    {"module": "addresses", "action": "delete", "code": "addresses.delete", "description": "Delete partner addresses"},
    # Audit
    {"module": "audit", "action": "view", "code": "audit.view", "description": "View audit logs"},
    # Dashboard
    {"module": "dashboard", "action": "view", "code": "dashboard.view", "description": "View dashboard analytics"},
    # Settings
    {"module": "settings", "action": "manage", "code": "settings.manage", "description": "Manage system settings"},
    # Expenses
    {"module": "expenses", "action": "view", "code": "expenses.view", "description": "View expenses"},
    {"module": "expenses", "action": "create", "code": "expenses.create", "description": "Create expenses"},
    {"module": "expenses", "action": "update", "code": "expenses.update", "description": "Update expenses"},
    {"module": "expenses", "action": "delete", "code": "expenses.delete", "description": "Delete expenses"},
    # Vehicles
    {"module": "vehicles", "action": "view", "code": "vehicles.view", "description": "View vehicles & fleet"},
    {"module": "vehicles", "action": "create", "code": "vehicles.create", "description": "Create vehicles & records"},
    {"module": "vehicles", "action": "update", "code": "vehicles.update", "description": "Update vehicles & records"},
    {"module": "vehicles", "action": "delete", "code": "vehicles.delete", "description": "Delete vehicles & records"},
]

INITIAL_ROLES = [
    {"name": "ADMIN", "description": "Full system administrator access"},
    {"name": "COMPTABLE", "description": "Accounting and billing access"},
    {"name": "MAGASINIER", "description": "Warehouse and stock management access"},
    {"name": "TECHNICIEN", "description": "Technical support and interventions access"},
    {"name": "USER", "description": "Basic authenticated user access"},
]


def bootstrap_system(db: Session = None) -> None:
    """Idempotently seeds initial permissions, system roles, role-permissions matrix, and admin account."""
    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        # 1. Seed Permissions
        perm_map = {}
        for pdata in INITIAL_PERMISSIONS:
            existing = db.query(Permission).filter(Permission.code == pdata["code"]).first()
            if not existing:
                existing = Permission(
                    module=pdata["module"],
                    action=pdata["action"],
                    code=pdata["code"],
                    description=pdata["description"],
                )
                db.add(existing)
                db.flush()
            perm_map[pdata["code"]] = existing

        # 2. Seed Roles
        role_map = {}
        for rdata in INITIAL_ROLES:
            existing = db.query(Role).filter(Role.name == rdata["name"]).first()
            if not existing:
                existing = Role(
                    name=rdata["name"],
                    description=rdata["description"],
                )
                db.add(existing)
                db.flush()
            role_map[rdata["name"]] = existing

        # 3. Associate Permissions to Roles
        admin_role = role_map["ADMIN"]
        admin_role.permissions = list(perm_map.values())

        comptable_role = role_map["COMPTABLE"]
        comptable_perms = [
            p for code, p in perm_map.items()
            if p.module in ("quotes", "sales", "delivery_notes", "invoices", "payments", "purchases", "purchase_receipts", "partners", "customers", "suppliers", "contacts", "addresses", "expenses", "dashboard", "audit")
        ]
        comptable_role.permissions = list({p.id: p for p in (comptable_role.permissions + comptable_perms)}.values())

        magasinier_role = role_map["MAGASINIER"]
        magasinier_perms = [
            p for code, p in perm_map.items()
            if p.module in (
                "products", "categories", "product_types", "brands", "units",
                "stock", "warehouses", "stock_movements", "stock_transfers",
                "stock_reservations", "inventory", "purchases", "purchase_receipts",
                "delivery_notes", "suppliers", "partners", "vehicles", "dashboard"
            )
        ]
        magasinier_role.permissions = list({p.id: p for p in (magasinier_role.permissions + magasinier_perms)}.values())

        tech_role = role_map["TECHNICIEN"]
        tech_perms = [p for code, p in perm_map.items() if p.module in ("tickets", "customers", "contacts", "vehicles", "dashboard")]
        tech_role.permissions = list({p.id: p for p in (tech_role.permissions + tech_perms)}.values())

        db.commit()

        # 4. Seed Admin User
        admin_user = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                first_name="System",
                last_name="Administrator",
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            admin_user.roles.append(admin_role)
            db.add(admin_user)
            db.commit()
            logger.info(f"Bootstrapped initial admin user: {settings.ADMIN_EMAIL}")
        else:
            if admin_role not in admin_user.roles:
                admin_user.roles.append(admin_role)
                db.commit()

    except Exception as e:
        db.rollback()
        logger.error(f"Error during system bootstrap: {str(e)}", exc_info=True)
        raise e
    finally:
        if close_session:
            db.close()
