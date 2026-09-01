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
