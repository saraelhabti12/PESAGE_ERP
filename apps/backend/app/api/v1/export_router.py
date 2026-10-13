from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.invoice_model import InvoiceType
from app.models.user_model import User
from app.security.deps import require_permission
from app.services.export_services import ExportService

router = APIRouter(prefix="/exports", tags=["Excel Exports"])


def _stream_excel(data_stream, filename: str) -> Response:
    return Response(
        content=data_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/customers", dependencies=[Depends(require_permission("partners.view"))])
def export_customers(db: Session = Depends(get_db)):
    stream = ExportService.export_partners(db, is_supplier=False)
    return _stream_excel(stream, "clients_pesage2000.xlsx")


@router.get("/suppliers", dependencies=[Depends(require_permission("partners.view"))])
def export_suppliers(db: Session = Depends(get_db)):
    stream = ExportService.export_partners(db, is_supplier=True)
    return _stream_excel(stream, "fournisseurs_pesage2000.xlsx")


@router.get("/employees", dependencies=[Depends(require_permission("users.view"))])
def export_employees(db: Session = Depends(get_db)):
    stream = ExportService.export_employees(db)
    return _stream_excel(stream, "personnel_employes.xlsx")


@router.get("/products", dependencies=[Depends(require_permission("catalog.view"))])
def export_products(db: Session = Depends(get_db)):
    stream = ExportService.export_products(db)
    return _stream_excel(stream, "catalogue_produits.xlsx")


@router.get("/quotes", dependencies=[Depends(require_permission("quotes.view"))])
def export_quotes(db: Session = Depends(get_db)):
    stream = ExportService.export_quotes(db)
    return _stream_excel(stream, "devis_commerciaux.xlsx")


@router.get("/sales", dependencies=[Depends(require_permission("sales.view"))])
def export_sales(db: Session = Depends(get_db)):
    stream = ExportService.export_sales(db)
    return _stream_excel(stream, "commandes_vente.xlsx")


@router.get("/purchases", dependencies=[Depends(require_permission("purchases.view"))])
def export_purchases(db: Session = Depends(get_db)):
    stream = ExportService.export_purchases(db)
    return _stream_excel(stream, "commandes_achat.xlsx")


@router.get("/invoices", dependencies=[Depends(require_permission("invoices.view"))])
def export_all_invoices(db: Session = Depends(get_db)):
    stream = ExportService.export_invoices(db)
    return _stream_excel(stream, "toutes_les_factures.xlsx")


@router.get("/invoices/customers", dependencies=[Depends(require_permission("invoices.view"))])
def export_customer_invoices(db: Session = Depends(get_db)):
    stream = ExportService.export_invoices(db, invoice_type=InvoiceType.CUSTOMER)
    return _stream_excel(stream, "factures_clients.xlsx")


@router.get("/invoices/suppliers", dependencies=[Depends(require_permission("invoices.view"))])
def export_supplier_invoices(db: Session = Depends(get_db)):
    stream = ExportService.export_invoices(db, invoice_type=InvoiceType.SUPPLIER)
    return _stream_excel(stream, "factures_fournisseurs.xlsx")


@router.get("/credit-notes", dependencies=[Depends(require_permission("invoices.view"))])
def export_credit_notes(db: Session = Depends(get_db)):
    stream = ExportService.export_credit_notes(db)
    return _stream_excel(stream, "avoirs_clients.xlsx")


@router.get("/payments", dependencies=[Depends(require_permission("invoices.view"))])
def export_payments(db: Session = Depends(get_db)):
    stream = ExportService.export_payments(db)
    return _stream_excel(stream, "reglements_paiements.xlsx")


@router.get("/stock", dependencies=[Depends(require_permission("stock.view"))])
def export_stock(db: Session = Depends(get_db)):
    stream = ExportService.export_stock(db)
    return _stream_excel(stream, "etat_des_stocks.xlsx")


@router.get("/stock/movements", dependencies=[Depends(require_permission("stock.view"))])
def export_stock_movements(db: Session = Depends(get_db)):
    stream = ExportService.export_stock_movements(db)
    return _stream_excel(stream, "mouvements_stock.xlsx")


@router.get("/expenses", dependencies=[Depends(require_permission("invoices.view"))])
def export_expenses(db: Session = Depends(get_db)):
    stream = ExportService.export_expenses(db)
    return _stream_excel(stream, "journal_depenses.xlsx")


@router.get("/vehicles", dependencies=[Depends(require_permission("stock.view"))])
def export_vehicles(db: Session = Depends(get_db)):
    stream = ExportService.export_vehicles(db)
    return _stream_excel(stream, "parc_vehicules.xlsx")


@router.get("/vehicles/maintenances", dependencies=[Depends(require_permission("stock.view"))])
def export_maintenances(db: Session = Depends(get_db)):
    stream = ExportService.export_maintenances(db)
    return _stream_excel(stream, "maintenances_vehicules.xlsx")
