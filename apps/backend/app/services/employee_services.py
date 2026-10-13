from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.employee_model import Employee
from app.schemas.employee_schemas import EmployeeCreate, EmployeeUpdate


class EmployeeService:
    @staticmethod
    def generate_employee_code(db: Session) -> str:
        """Generates sequential employee code: EMP-YYYY-XXXX."""
        now = datetime.now(timezone.utc)
        prefix = f"EMP-{now.strftime('%Y')}-"
        count = db.query(func.count(Employee.id)).filter(Employee.employee_code.like(f"{prefix}%")).scalar() or 0
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_employee(cls, db: Session, data: EmployeeCreate) -> Employee:
        code = data.employee_code.strip() if data.employee_code and data.employee_code.strip() and data.employee_code.strip().upper() != "AUTO" else cls.generate_employee_code(db)

        existing = db.query(Employee).filter(Employee.employee_code == code).first()
        if existing:
            if not data.employee_code or data.employee_code.strip().upper() == "AUTO":
                count = db.query(func.count(Employee.id)).scalar() or 0
                code = f"{code}-{count + 1}"
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Le matricule employé '{code}' est déjà utilisé.",
                )

        employee = Employee(
            employee_code=code,
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            phone=data.phone.strip() if data.phone else None,
            email=data.email.strip().lower() if data.email else None,
            job_title=data.job_title.strip() if data.job_title else None,
            department=data.department.strip() if data.department else None,
            hire_date=data.hire_date,
            is_active=data.is_active,
            notes=data.notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee

    @classmethod
    def get_employee(cls, db: Session, employee_id: int) -> Employee:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé introuvable.")
        return emp

    @classmethod
    def update_employee(cls, db: Session, employee_id: int, data: EmployeeUpdate) -> Employee:
        emp = cls.get_employee(db, employee_id)
        update_dict = data.model_dump(exclude_unset=True)

        for field, val in update_dict.items():
            if val is not None and isinstance(val, str):
                val = val.strip()
            setattr(emp, field, val)

        emp.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(emp)
        return emp

    @classmethod
    def delete_employee(cls, db: Session, employee_id: int) -> Employee:
        emp = cls.get_employee(db, employee_id)
        emp.is_active = False
        emp.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(emp)
        return emp

    @classmethod
    def list_employees(
        cls,
        db: Session,
        search: Optional[str] = None,
        department: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Employee], int]:
        query = db.query(Employee)

        if is_active is not None:
            query = query.filter(Employee.is_active == is_active)

        if department:
            query = query.filter(Employee.department == department)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Employee.employee_code.ilike(s),
                    Employee.first_name.ilike(s),
                    Employee.last_name.ilike(s),
                    Employee.email.ilike(s),
                    Employee.phone.ilike(s),
                    Employee.job_title.ilike(s),
                )
            )

        total = query.count()
        items = query.order_by(Employee.last_name.asc(), Employee.first_name.asc()).offset(skip).limit(limit).all()
        return items, total
