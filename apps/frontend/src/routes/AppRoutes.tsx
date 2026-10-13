import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { RolesPage } from '@/pages/RolesPage';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ProductTypesPage } from '@/pages/ProductTypesPage';
import { BrandsPage } from '@/pages/BrandsPage';
import { UnitsPage } from '@/pages/UnitsPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { PartnerDetailPage } from '@/pages/PartnerDetailPage';
import { PurchasesPage } from '@/pages/PurchasesPage';
import { QuotesPage } from '@/pages/QuotesPage';
import { QuoteDetailPage } from '@/pages/QuoteDetailPage';
import { SalesPage } from '@/pages/SalesPage';
import { SaleDetailPage } from '@/pages/SaleDetailPage';
import { DeliveryNotesPage } from '@/pages/DeliveryNotesPage';
import { DeliveryNoteDetailPage } from '@/pages/DeliveryNoteDetailPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { CustomerInvoicesPage } from '@/pages/CustomerInvoicesPage';
import { SupplierInvoicesPage } from '@/pages/SupplierInvoicesPage';
import { InvoiceDetailPage } from '@/pages/InvoiceDetailPage';
import { CreditNotesPage } from '@/pages/CreditNotesPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { PersonnelPage } from '@/pages/PersonnelPage';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { ReportsPage } from '@/pages/ReportsPage';
import { WarehousesPage } from '@/pages/WarehousesPage';
import { StockPage } from '@/pages/StockPage';
import { StockMovementsPage } from '@/pages/StockMovementsPage';
import { StockTransfersPage } from '@/pages/StockTransfersPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { InventoryDetailPage } from '@/pages/InventoryDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Protected ERP Application Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/product-types" element={<ProductTypesPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/units" element={<UnitsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/fournisseurs" element={<SuppliersPage />} />
          <Route path="/suppliers" element={<Navigate to="/fournisseurs" replace />} />
          <Route path="/achats" element={<PurchasesPage />} />
          <Route path="/purchases" element={<Navigate to="/achats" replace />} />

          {/* Complete Commercial Cycle Routes */}
          <Route path="/devis" element={<QuotesPage />} />
          <Route path="/quotes" element={<Navigate to="/devis" replace />} />
          <Route path="/devis/:id" element={<QuoteDetailPage />} />
          <Route path="/quotes/:id" element={<QuoteDetailPage />} />

          <Route path="/ventes" element={<SalesPage />} />
          <Route path="/sales" element={<Navigate to="/ventes" replace />} />
          <Route path="/ventes/:id" element={<SaleDetailPage />} />
          <Route path="/sales/:id" element={<Navigate to="/ventes/:id" replace />} />

          <Route path="/livraisons" element={<DeliveryNotesPage />} />
          <Route path="/delivery-notes" element={<Navigate to="/livraisons" replace />} />
          <Route path="/livraisons/:id" element={<DeliveryNoteDetailPage />} />
          <Route path="/delivery-notes/:id" element={<DeliveryNoteDetailPage />} />

          {/* Invoices (Separated Customer vs Supplier) */}
          <Route path="/factures-vente" element={<CustomerInvoicesPage />} />
          <Route path="/factures" element={<Navigate to="/factures-vente" replace />} />
          <Route path="/invoices" element={<Navigate to="/factures-vente" replace />} />
          <Route path="/factures-achat" element={<SupplierInvoicesPage />} />
          <Route path="/factures-fournisseurs" element={<Navigate to="/factures-achat" replace />} />
          <Route path="/factures/:id" element={<InvoiceDetailPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/factures-vente/:id" element={<InvoiceDetailPage />} />
          <Route path="/factures-achat/:id" element={<InvoiceDetailPage />} />

          {/* Credit Notes (Avoirs) */}
          <Route path="/avoirs" element={<CreditNotesPage />} />
          <Route path="/credit-notes" element={<Navigate to="/avoirs" replace />} />

          {/* Maintenance & Interventions */}
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/interventions" element={<Navigate to="/maintenance" replace />} />

          {/* Expenses & Cash */}
          <Route path="/depenses" element={<ExpensesPage />} />
          <Route path="/expenses" element={<Navigate to="/depenses" replace />} />

          {/* Personnel */}
          <Route path="/personnel" element={<PersonnelPage />} />
          <Route path="/employees" element={<Navigate to="/personnel" replace />} />

          {/* Vehicles & Fleet */}
          <Route path="/vehicules" element={<VehiclesPage />} />
          <Route path="/vehicles" element={<Navigate to="/vehicules" replace />} />
          <Route path="/flotte" element={<Navigate to="/vehicules" replace />} />

          {/* Reports & Analytics */}
          <Route path="/rapports" element={<ReportsPage />} />
          <Route path="/reports" element={<Navigate to="/rapports" replace />} />

          {/* Stock & Warehouses Routes */}
          <Route path="/depots" element={<WarehousesPage />} />
          <Route path="/warehouses" element={<Navigate to="/depots" replace />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/stock/mouvements" element={<StockMovementsPage />} />
          <Route path="/stock-movements" element={<Navigate to="/stock/mouvements" replace />} />
          <Route path="/stock/transferts" element={<StockTransfersPage />} />
          <Route path="/stock-transfers" element={<Navigate to="/stock/transferts" replace />} />
          <Route path="/stock/inventaires" element={<InventoryPage />} />
          <Route path="/inventory" element={<Navigate to="/stock/inventaires" replace />} />
          <Route path="/stock/inventaires/:id" element={<InventoryDetailPage />} />
          <Route path="/inventory/:id" element={<InventoryDetailPage />} />

          {/* Admin, Profile & Partners */}
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/profile" element={<Navigate to="/profil" replace />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="/settings" element={<Navigate to="/parametres" replace />} />
          <Route path="/partners/:id" element={<PartnerDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/permissions" element={<PermissionsPage />} />
        </Route>
      </Route>

      {/* Fallback Redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
