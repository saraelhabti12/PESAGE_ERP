from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.employee_schemas import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.security.deps import get_current_user, require_permission
from app.services.employee_services import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get(
    "/next-code",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.view"))],
)
def get_next_employee_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    """Returns the preview of the next automatically generated employee code."""
    return {"code": EmployeeService.generate_employee_code(db)}


@router.get(
    "",
    response_model=List[EmployeeRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.view"))],
)
def list_employees(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    """Lists employees with search, department filtering, and pagination."""
    skip = (page - 1) * size
    items, _ = EmployeeService.list_employees(
        db=db,
        search=search,
        department=department,
        is_active=is_active,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("users.create"))],
)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates an employee with automatic matricule code generation."""
    return EmployeeService.create_employee(db=db, data=data)


@router.get(
    "/{employee_id}",
    response_model=EmployeeRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.view"))],
)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    """Retrieves single employee by ID."""
    return EmployeeService.get_employee(db=db, employee_id=employee_id)


@router.put(
    "/{employee_id}",
    response_model=EmployeeRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.update"))],
)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.update")),
):
    """Updates employee profile."""
    return EmployeeService.update_employee(db=db, employee_id=employee_id, data=data)


@router.delete(
    "/{employee_id}",
    response_model=EmployeeRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("users.delete"))],
)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.delete")),
):
    """Deactivates employee."""
    return EmployeeService.delete_employee(db=db, employee_id=employee_id)
