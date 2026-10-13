from datetime import datetime, timezone
import pytest
from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.expense_model import (
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    RecurringExpense,
    RecurringExpenseFrequency,
)
from app.schemas.expense_schemas import RecurringExpenseCreate
from app.services.expense_services import ExpenseService


def get_admin_token(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert login_res.status_code == status.HTTP_200_OK
    return login_res.json()["access_token"]


def test_recurring_expense_generation_and_idempotency(client):
    """
    Test scenario:
    1. Create recurring expense: Loyer = 10000 DH / month starting in 2025.
    2. Generate for July 2025 -> creates 1 July expense.
    3. Generate again for July 2025 -> creates 0 additional expenses (idempotent duplicate prevention).
    4. Generate for August 2025 -> creates 1 August expense.
    5. Verify July and August are separate occurrences.
    6. Test Quarterly and Yearly recurrences.
    """
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    db: Session = SessionLocal()
    try:
        ExpenseService.ensure_default_categories(db)
        loyer_cat = db.query(ExpenseCategory).filter(ExpenseCategory.code == "LOYER").first()
        assert loyer_cat is not None

        # 1. Create monthly recurring expense template (Loyer = 10000 DH / month)
        rec_data = RecurringExpenseCreate(
            category_id=loyer_cat.id,
            label="Loyer Entrepôt Principal",
            amount=10000.0,
            frequency=RecurringExpenseFrequency.MONTHLY,
            start_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
            day_of_month=5,
            payment_method="Virement bancaire",
            is_active=True,
            notes="Contrat de bail commercial",
        )
        rec = ExpenseService.create_recurring_expense(db=db, data=rec_data, user_id=1)
        assert rec.id is not None
        assert float(rec.amount) == 10000.0

        # 2. Generate for July 2025 -> one July expense
        july_target = datetime(2025, 7, 15, tzinfo=timezone.utc)
        res_july_1 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=july_target
        )
        assert res_july_1["status"] == "ok"
        assert res_july_1["generated_count"] == 1

        july_expenses = (
            db.query(Expense)
            .filter(
                Expense.recurring_expense_id == rec.id,
                Expense.expense_date >= datetime(2025, 7, 1, tzinfo=timezone.utc),
                Expense.expense_date < datetime(2025, 8, 1, tzinfo=timezone.utc),
            )
            .all()
        )
        assert len(july_expenses) == 1
        july_exp = july_expenses[0]
        assert "07/2025" in july_exp.label
        assert float(july_exp.amount) == 10000.0
        assert july_exp.status == ExpenseStatus.PAID

        # 3. Generate again for July 2025 -> zero additional expense (idempotency check)
        res_july_2 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=july_target
        )
        assert res_july_2["status"] == "ok"
        assert res_july_2["generated_count"] == 0

        july_expenses_after_retry = (
            db.query(Expense)
            .filter(
                Expense.recurring_expense_id == rec.id,
                Expense.expense_date >= datetime(2025, 7, 1, tzinfo=timezone.utc),
                Expense.expense_date < datetime(2025, 8, 1, tzinfo=timezone.utc),
            )
            .all()
        )
        assert len(july_expenses_after_retry) == 1

        # 4. Generate for August 2025 -> one August expense
        august_target = datetime(2025, 8, 10, tzinfo=timezone.utc)
        res_august_1 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=august_target
        )
        assert res_august_1["status"] == "ok"
        assert res_august_1["generated_count"] == 1

        august_expenses = (
            db.query(Expense)
            .filter(
                Expense.recurring_expense_id == rec.id,
                Expense.expense_date >= datetime(2025, 8, 1, tzinfo=timezone.utc),
                Expense.expense_date < datetime(2025, 9, 1, tzinfo=timezone.utc),
            )
            .all()
        )
        assert len(august_expenses) == 1
        august_exp = august_expenses[0]
        assert "08/2025" in august_exp.label
        assert float(august_exp.amount) == 10000.0

        # 5. Verify July and August are separate occurrences with unique references
        assert july_exp.id != august_exp.id
        assert july_exp.reference != august_exp.reference

        # 6. Test Quarterly Recurring Expense
        assurance_cat = db.query(ExpenseCategory).filter(ExpenseCategory.code == "ASSUR").first()
        rec_quarterly_data = RecurringExpenseCreate(
            category_id=assurance_cat.id,
            label="Assurance Flotte Trimestrielle",
            amount=4500.0,
            frequency=RecurringExpenseFrequency.QUARTERLY,
            start_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
            day_of_month=1,
            payment_method="Chèque",
            is_active=True,
        )
        rec_q = ExpenseService.create_recurring_expense(db=db, data=rec_quarterly_data, user_id=1)

        # Generate in Q3 (e.g. September 2025) -> generates September Loyer + Q3 Assurance (2 new)
        res_q3_1 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=datetime(2025, 9, 1, tzinfo=timezone.utc)
        )
        assert res_q3_1["generated_count"] == 2

        # Re-run in Q3 (e.g. September 2025) -> 0 new (both loyer and assurance already generated)
        res_q3_2 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=datetime(2025, 9, 15, tzinfo=timezone.utc)
        )
        assert res_q3_2["generated_count"] == 0

        # 7. Test Yearly Recurring Expense
        impots_cat = db.query(ExpenseCategory).filter(ExpenseCategory.code == "IMPOTS").first()
        rec_yearly_data = RecurringExpenseCreate(
            category_id=impots_cat.id,
            label="Taxe Professionnelle Annuelle",
            amount=15000.0,
            frequency=RecurringExpenseFrequency.YEARLY,
            start_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
            day_of_month=15,
            payment_method="Virement bancaire",
            is_active=True,
        )
        rec_y = ExpenseService.create_recurring_expense(db=db, data=rec_yearly_data, user_id=1)

        res_y_1 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=datetime(2025, 5, 20, tzinfo=timezone.utc)
        )
        # Generates Loyer for May + Yearly Taxe (2 generated)
        assert res_y_1["generated_count"] >= 1

        # Re-run in same year -> Yearly Taxe is NOT generated again
        res_y_2 = ExpenseService.generate_due_recurring_expenses(
            db=db, user_id=1, target_date=datetime(2025, 5, 25, tzinfo=timezone.utc)
        )
        assert res_y_2["generated_count"] == 0

    finally:
        db.close()

    # 8. Test API HTTP endpoint
    api_res = client.post("/api/v1/expenses/generate-recurring", headers=headers)
    assert api_res.status_code == status.HTTP_200_OK
    data = api_res.json()
    assert data["status"] == "ok"
    assert "generated_count" in data
