import sys
from pathlib import Path

# Add app parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.database import SessionLocal
from app.core.bootstrap import bootstrap_system
from app.core.config import settings


@pytest.fixture(autouse=True)
def db_clean_and_bootstrap():
    """Ensure clean test environment before each test while keeping system roles and Admin."""
    db = SessionLocal()
    try:
        # Delete notification data and audit logs
        db.execute(text("DELETE FROM notifications;"))
        db.execute(text("DELETE FROM audit_logs;"))

        # Delete maintenance module tables
        db.execute(text("DELETE FROM intervention_tasks;"))
        db.execute(text("DELETE FROM intervention_parts;"))
        db.execute(text("DELETE FROM interventions;"))
        db.execute(text("DELETE FROM equipments;"))

        # Delete new finalization modules data
        db.execute(text("DELETE FROM credit_note_items;"))
        db.execute(text("DELETE FROM credit_notes;"))
        db.execute(text("DELETE FROM fuel_logs;"))
        db.execute(text("DELETE FROM vehicle_maintenances;"))
        db.execute(text("DELETE FROM vehicles;"))
        db.execute(text("DELETE FROM expenses;"))
        db.execute(text("DELETE FROM recurring_expenses;"))
        db.execute(text("DELETE FROM employees;"))

        # Delete commercial cycle tables
        db.execute(text("DELETE FROM payments;"))
        db.execute(text("DELETE FROM invoice_items;"))
        db.execute(text("DELETE FROM invoices;"))
        db.execute(text("DELETE FROM delivery_note_items;"))
        db.execute(text("DELETE FROM delivery_notes;"))
        db.execute(text("DELETE FROM sale_items;"))
        db.execute(text("DELETE FROM sales;"))
        db.execute(text("DELETE FROM quote_items;"))
        db.execute(text("DELETE FROM quotes;"))

        # Delete purchase data
        db.execute(text("DELETE FROM purchase_receipt_items;"))
        db.execute(text("DELETE FROM purchase_receipts;"))
        db.execute(text("DELETE FROM purchase_order_items;"))
        db.execute(text("DELETE FROM purchase_orders;"))

        # Delete partner data
        db.execute(text("DELETE FROM partner_contacts;"))
        db.execute(text("DELETE FROM partner_addresses;"))
        db.execute(text("DELETE FROM business_partners;"))

        # Delete stock data
        db.execute(text("DELETE FROM inventory_items;"))
        db.execute(text("DELETE FROM inventory_sessions;"))
        db.execute(text("DELETE FROM stock_reservations;"))
        db.execute(text("DELETE FROM stock_movements;"))
        db.execute(text("DELETE FROM stock_balances;"))
        db.execute(text("DELETE FROM warehouses;"))

        # Delete catalog data
        db.execute(text("DELETE FROM products;"))
        db.execute(text("DELETE FROM categories;"))
        db.execute(text("DELETE FROM product_types;"))
        db.execute(text("DELETE FROM brands;"))
        db.execute(text("DELETE FROM units;"))
        
        # Delete non-admin test users and their sessions
        db.execute(
            text("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email != :admin_email);"),
            {"admin_email": settings.ADMIN_EMAIL},
        )
        db.execute(
            text("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email != :admin_email);"),
            {"admin_email": settings.ADMIN_EMAIL},
        )
        db.execute(
            text("DELETE FROM users WHERE email != :admin_email;"),
            {"admin_email": settings.ADMIN_EMAIL},
        )
        db.commit()
    finally:
        db.close()

    # Re-run bootstrap idempotently to ensure admin user and all RBAC permissions exist
    bootstrap_system()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
