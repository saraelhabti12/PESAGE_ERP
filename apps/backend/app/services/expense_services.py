from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.employee_model import Employee
from app.models.expense_model import (
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    RecurringExpense,
    RecurringExpenseFrequency,
)
from app.models.vehicle_model import Vehicle
from app.schemas.expense_schemas import (
    CategoryExpenseStat,
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseStatistics,
    ExpenseUpdate,
    MonthlyExpenseStat,
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
)


DEFAULT_EXPENSE_CATEGORIES = [
    ("Loyer", "LOYER", "Loyer des locaux et entrepôts"),
    ("Internet", "INTERNET", "Abonnements internet et fibre"),
    ("Eau", "EAU", "Factures d'eau"),
    ("Électricité", "ELEC", "Factures d'électricité"),
    ("Téléphone", "TEL", "Forfaits mobiles et téléphonie"),
    ("Carburant", "CARB", "Dépenses carburant hors flotte directe"),
    ("Entretien", "ENTR", "Entretien et réparations locaux"),
    ("Fournitures", "FOURN", "Fournitures de bureau et consommables"),
    ("Transport", "TRANSP", "Frais de transport et logistique"),
    ("Salaires", "SALAIRES", "Charges de salaires et primes"),
    ("Impôts", "IMPOTS", "Impôts, taxes et vignettes"),
    ("Assurance", "ASSUR", "Assurances multirisques et RC"),
    ("Abonnements", "ABONN", "Logiciels, SaaS et services"),
    ("Déplacement", "DEPL", "Frais de mission et déplacements"),
    ("Petite caisse", "CAISSE", "Dépenses courantes petite caisse"),
    ("Autre", "AUTRE", "Autres charges diverses"),
]


class ExpenseService:
    @classmethod
    def ensure_default_categories(cls, db: Session) -> None:
        """Seeds default expense categories if table is empty or missing them."""
        for name, code, desc in DEFAULT_EXPENSE_CATEGORIES:
            existing = db.query(ExpenseCategory).filter(
                or_(ExpenseCategory.code == code, ExpenseCategory.name == name)
            ).first()
            if not existing:
                cat = ExpenseCategory(
                    name=name,
                    code=code,
                    description=desc,
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(cat)
        db.commit()

    @staticmethod
    @staticmethod
    def generate_expense_reference(db: Session, offset: int = 0) -> str:
        """Generates sequential reference: DEP-YYYYMM-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"DEP-{now.strftime('%Y%m')}-"
        last_exp = (
            db.query(Expense.reference)
            .filter(Expense.reference.like(f"{prefix}%"))
            .order_by(Expense.reference.desc())
            .first()
        )
        if last_exp and last_exp[0]:
            try:
                seq = int(last_exp[0].split("-")[-1])
                return f"{prefix}{seq + 1 + offset:04d}"
            except (ValueError, IndexError):
                pass
        count = db.query(func.count(Expense.id)).filter(Expense.reference.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1 + offset:04d}"

    # ----------------------------------------------------
    # CATEGORIES
    # ----------------------------------------------------
    @classmethod
    def list_categories(cls, db: Session) -> List[ExpenseCategory]:
        cls.ensure_default_categories(db)
        return db.query(ExpenseCategory).order_by(ExpenseCategory.name.asc()).all()

    @classmethod
    def create_category(cls, db: Session, data: ExpenseCategoryCreate) -> ExpenseCategory:
        existing = db.query(ExpenseCategory).filter(
            or_(ExpenseCategory.name == data.name.strip(), ExpenseCategory.code == data.code.strip().upper())
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une catégorie avec ce nom ou code existe déjà.",
            )
        cat = ExpenseCategory(
            name=data.name.strip(),
            code=data.code.strip().upper(),
            description=data.description.strip() if data.description else None,
            is_active=data.is_active,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat

    @classmethod
    def update_category(cls, db: Session, cat_id: int, data: ExpenseCategoryUpdate) -> ExpenseCategory:
        cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")

        if data.name:
            cat.name = data.name.strip()
        if data.description is not None:
            cat.description = data.description.strip() if data.description else None
        if data.is_active is not None:
            cat.is_active = data.is_active

        cat.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(cat)
        return cat

    # ----------------------------------------------------
    # RECURRING EXPENSES
    # ----------------------------------------------------
    @classmethod
    def create_recurring_expense(cls, db: Session, data: RecurringExpenseCreate, user_id: int) -> RecurringExpense:
        cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == data.category_id).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Catégorie de dépense invalide.")

        rec = RecurringExpense(
            category_id=data.category_id,
            label=data.label.strip(),
            amount=float(data.amount),
            frequency=data.frequency,
            start_date=data.start_date,
            end_date=data.end_date,
            day_of_month=data.day_of_month,
            payment_method=data.payment_method,
            is_active=data.is_active,
            notes=data.notes,
            created_by=user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return rec

    @classmethod
    def update_recurring_expense(cls, db: Session, rec_id: int, data: RecurringExpenseUpdate) -> RecurringExpense:
        rec = db.query(RecurringExpense).filter(RecurringExpense.id == rec_id).first()
        if not rec:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépense récurrente introuvable.")

        update_dict = data.model_dump(exclude_unset=True)
        for field, val in update_dict.items():
            setattr(rec, field, val)

        rec.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(rec)
        return rec

    @classmethod
    def list_recurring_expenses(cls, db: Session) -> List[RecurringExpense]:
        return (
            db.query(RecurringExpense)
            .options(
                selectinload(RecurringExpense.category),
                selectinload(RecurringExpense.creator),
            )
            .order_by(RecurringExpense.label.asc())
            .all()
        )

    @classmethod
    def generate_due_recurring_expenses(
        cls, db: Session, user_id: int = 1, target_date: Optional[datetime] = None
    ) -> dict:
        """Safely and idempotently generates real expense occurrences from active recurring expenses for the specified or current period."""
        import calendar

        target = target_date or datetime.now(timezone.utc)
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)

        # Active templates at target date
        active_recs = db.query(RecurringExpense).filter(
            RecurringExpense.is_active == True,
            RecurringExpense.start_date <= target,
            or_(RecurringExpense.end_date.is_(None), RecurringExpense.end_date >= target),
        ).all()

        generated_count = 0
        details = []

        for rec in active_recs:
            # Determine period bounds according to recurrence frequency
            if rec.frequency == RecurringExpenseFrequency.YEARLY:
                start_period = datetime(target.year, 1, 1, tzinfo=timezone.utc)
                end_period = datetime(target.year + 1, 1, 1, tzinfo=timezone.utc)
                period_str = f"{target.year}"
            elif rec.frequency == RecurringExpenseFrequency.QUARTERLY:
                q = (target.month - 1) // 3 + 1
                start_month = (q - 1) * 3 + 1
                start_period = datetime(target.year, start_month, 1, tzinfo=timezone.utc)
                if q == 4:
                    end_period = datetime(target.year + 1, 1, 1, tzinfo=timezone.utc)
                else:
                    end_period = datetime(target.year, q * 3 + 1, 1, tzinfo=timezone.utc)
                period_str = f"T{q}/{target.year}"
            else:  # MONTHLY (default)
                start_period = datetime(target.year, target.month, 1, tzinfo=timezone.utc)
                if target.month == 12:
                    end_period = datetime(target.year + 1, 1, 1, tzinfo=timezone.utc)
                else:
                    end_period = datetime(target.year, target.month + 1, 1, tzinfo=timezone.utc)
                period_str = f"{target.month:02d}/{target.year}"

            # Strict idempotency check: has an occurrence already been generated for this exact period?
            already_generated = db.query(Expense).filter(
                Expense.recurring_expense_id == rec.id,
                Expense.expense_date >= start_period,
                Expense.expense_date < end_period,
                Expense.status != ExpenseStatus.CANCELLED,
            ).first()

            if not already_generated:
                ref = cls.generate_expense_reference(db, offset=generated_count)
                
                # Compute valid day in target month
                _, max_day = calendar.monthrange(target.year, target.month)
                day = min(max(1, rec.day_of_month or 1), max_day)
                expense_date = datetime(target.year, target.month, day, tzinfo=timezone.utc)

                expense = Expense(
                    reference=ref,
                    expense_date=expense_date,
                    category_id=rec.category_id,
                    label=f"{rec.label} ({period_str})",
                    amount=float(rec.amount),
                    payment_method=rec.payment_method or "Virement bancaire",
                    supplier_payee=None,
                    recurring_expense_id=rec.id,
                    status=ExpenseStatus.PAID,
                    notes=f"Génération automatique pour {period_str}",
                    created_by=user_id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(expense)
                db.flush()
                rec.last_generated_date = datetime.now(timezone.utc)
                rec.updated_at = datetime.now(timezone.utc)
                generated_count += 1
                details.append({"recurring_id": rec.id, "label": rec.label, "reference": ref, "period": period_str})

        db.commit()
        return {
            "status": "ok",
            "generated_count": generated_count,
            "active_recurring_expenses": len(active_recs),
            "period": f"{target.month:02d}/{target.year}",
            "details": details,
        }

    # ----------------------------------------------------
    # VARIABLE EXPENSES
    # ----------------------------------------------------
    @classmethod
    def create_expense(cls, db: Session, data: ExpenseCreate, user_id: int) -> Expense:
        cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == data.category_id).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Catégorie de dépense invalide.")

        if data.employee_id:
            emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
            if not emp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employé spécifié introuvable.")

        if data.vehicle_id:
            veh = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
            if not veh:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Véhicule spécifié introuvable.")

        ref = data.reference.strip() if data.reference and data.reference.strip() else cls.generate_expense_reference(db)
        existing = db.query(Expense).filter(Expense.reference == ref).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Une dépense avec la référence '{ref}' existe déjà.",
            )

        expense = Expense(
            reference=ref,
            expense_date=data.expense_date or datetime.now(timezone.utc),
            category_id=data.category_id,
            label=data.label.strip(),
            amount=round(float(data.amount), 2),
            payment_method=data.payment_method,
            supplier_payee=data.supplier_payee.strip() if data.supplier_payee else None,
            employee_id=data.employee_id,
            vehicle_id=data.vehicle_id,
            recurring_expense_id=data.recurring_expense_id,
            status=data.status,
            notes=data.notes,
            created_by=user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return expense

    @classmethod
    def update_expense(cls, db: Session, expense_id: int, data: ExpenseUpdate) -> Expense:
        expense = db.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépense introuvable.")

        update_dict = data.model_dump(exclude_unset=True)
        for field, val in update_dict.items():
            if field == "amount" and val is not None:
                val = round(float(val), 2)
            setattr(expense, field, val)

        expense.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(expense)
        return expense

    @classmethod
    def get_expense(cls, db: Session, expense_id: int) -> Expense:
        exp = (
            db.query(Expense)
            .options(
                selectinload(Expense.category),
                selectinload(Expense.employee),
                selectinload(Expense.vehicle),
                selectinload(Expense.creator),
            )
            .filter(Expense.id == expense_id)
            .first()
        )
        if not exp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépense introuvable.")
        return exp

    @classmethod
    def list_expenses(
        cls,
        db: Session,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        vehicle_id: Optional[int] = None,
        status_filter: Optional[ExpenseStatus] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_amount: Optional[float] = None,
        max_amount: Optional[float] = None,
        payment_method: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Expense], int]:
        query = (
            db.query(Expense)
            .join(Expense.category)
            .options(
                selectinload(Expense.category),
                selectinload(Expense.employee),
                selectinload(Expense.vehicle),
                selectinload(Expense.creator),
            )
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Expense.reference.ilike(s),
                    Expense.label.ilike(s),
                    Expense.supplier_payee.ilike(s),
                    ExpenseCategory.name.ilike(s),
                )
            )

        if category_id:
            query = query.filter(Expense.category_id == category_id)

        if employee_id:
            query = query.filter(Expense.employee_id == employee_id)

        if vehicle_id:
            query = query.filter(Expense.vehicle_id == vehicle_id)

        if status_filter:
            query = query.filter(Expense.status == status_filter)

        if date_from:
            query = query.filter(Expense.expense_date >= date_from)

        if date_to:
            query = query.filter(Expense.expense_date <= date_to)

        if min_amount is not None:
            query = query.filter(Expense.amount >= min_amount)

        if max_amount is not None:
            query = query.filter(Expense.amount <= max_amount)

        if payment_method:
            query = query.filter(Expense.payment_method.ilike(f"%{payment_method}%"))

        total = query.count()
        items = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).offset(skip).limit(limit).all()
        return items, total

    # ----------------------------------------------------
    # EXPENSE STATISTICS
    # ----------------------------------------------------
    @classmethod
    def get_statistics(cls, db: Session) -> ExpenseStatistics:
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)

        total_sum = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED
        ).scalar() or 0.0

        fixed_sum = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.recurring_expense_id.isnot(None),
        ).scalar() or 0.0

        var_sum = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.recurring_expense_id.is_(None),
        ).scalar() or 0.0

        this_month = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.expense_date >= start_of_month,
        ).scalar() or 0.0

        this_year = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.status != ExpenseStatus.CANCELLED,
            Expense.expense_date >= start_of_year,
        ).scalar() or 0.0

        # By category
        cat_rows = (
            db.query(ExpenseCategory.id, ExpenseCategory.name, func.coalesce(func.sum(Expense.amount), 0.0))
            .join(Expense, Expense.category_id == ExpenseCategory.id)
            .filter(Expense.status != ExpenseStatus.CANCELLED)
            .group_by(ExpenseCategory.id, ExpenseCategory.name)
            .all()
        )

        by_cat = []
        tot_val = float(total_sum) or 1.0
        for cat_id, cat_name, amt in cat_rows:
            amt_val = float(amt)
            by_cat.append(
                CategoryExpenseStat(
                    category_id=cat_id,
                    category_name=cat_name,
                    total_amount=round(amt_val, 2),
                    percentage=round((amt_val / tot_val) * 100.0, 1),
                )
            )

        # By payment method
        pm_rows = (
            db.query(Expense.payment_method, func.coalesce(func.sum(Expense.amount), 0.0))
            .filter(Expense.status != ExpenseStatus.CANCELLED)
            .group_by(Expense.payment_method)
            .all()
        )
        by_pm = {r[0] or "Autre": round(float(r[1]), 2) for r in pm_rows}

        # By month (last 6 months)
        by_month = []
        for i in range(5, -1, -1):
            m_year = now.year
            m_month = now.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1

            m_start = datetime(m_year, m_month, 1, tzinfo=timezone.utc)
            if m_month == 12:
                m_end = datetime(m_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                m_end = datetime(m_year, m_month + 1, 1, tzinfo=timezone.utc)

            m_total = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
                Expense.status != ExpenseStatus.CANCELLED,
                Expense.expense_date >= m_start,
                Expense.expense_date < m_end,
            ).scalar() or 0.0

            m_fixed = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
                Expense.status != ExpenseStatus.CANCELLED,
                Expense.recurring_expense_id.isnot(None),
                Expense.expense_date >= m_start,
                Expense.expense_date < m_end,
            ).scalar() or 0.0

            m_var = float(m_total) - float(m_fixed)

            by_month.append(
                MonthlyExpenseStat(
                    month=f"{m_month:02d}/{m_year}",
                    total_amount=round(float(m_total), 2),
                    fixed_amount=round(float(m_fixed), 2),
                    variable_amount=round(float(m_var), 2),
                )
            )

        return ExpenseStatistics(
            total_expenses=round(float(total_sum), 2),
            fixed_expenses=round(float(fixed_sum), 2),
            variable_expenses=round(float(var_sum), 2),
            this_month=round(float(this_month), 2),
            this_year=round(float(this_year), 2),
            by_category=by_cat,
            by_month=by_month,
            by_payment_method=by_pm,
        )
