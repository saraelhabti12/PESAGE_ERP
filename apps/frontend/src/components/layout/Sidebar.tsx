import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Key,
  Package,
  Layers,
  Tag,
  Award,
  Scale,
  LogOut,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ShoppingBag,
  Warehouse,
  Boxes,
  ArrowRightLeft,
  History,
  ClipboardList,
  FileText,
  Wrench,
  LifeBuoy,
  Receipt,
  Calendar,
  PanelLeftClose,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  isAvailable: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  primaryPath?: string;
  icon: React.ElementType;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = true,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Accordion state persistence
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('pesage_sidebar_groups');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      dashboard: true,
      admin: true,
      catalog: true,
      commercial: false,
      stock: false,
      services: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('pesage_sidebar_groups', JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    const path = location.pathname;
    if (['/products', '/categories', '/product-types', '/brands', '/units'].includes(path)) {
      setOpenGroups((prev) => ({ ...prev, catalog: true }));
    } else if (['/users', '/roles', '/permissions'].includes(path)) {
      setOpenGroups((prev) => ({ ...prev, admin: true }));
    } else if (['/clients', '/fournisseurs', '/suppliers', '/achats', '/purchases'].includes(path) || path.startsWith('/partners/')) {
      setOpenGroups((prev) => ({ ...prev, commercial: true }));
    } else if (
      ['/stock', '/depots', '/warehouses', '/stock/mouvements', '/stock-movements', '/stock/transferts', '/stock-transfers', '/stock/inventaires', '/inventory'].includes(path) ||
      path.startsWith('/stock/inventaires/')
    ) {
      setOpenGroups((prev) => ({ ...prev, stock: true }));
    } else if (path === '/dashboard') {
      setOpenGroups((prev) => ({ ...prev, dashboard: true }));
    }
  }, [location.pathname]);

  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile();
  };

  const handleExpandedGroupHeaderClick = (group: NavGroup) => {
    const isCurrentlyOpen = openGroups[group.id] ?? true;
    const nextState = !isCurrentlyOpen;

    setOpenGroups((prev) => ({
      ...prev,
      [group.id]: nextState,
    }));

    if (nextState && group.primaryPath) {
      navigate(group.primaryPath);
      handleNavClick();
    }
  };

  const handleCollapsedGroupClick = (group: NavGroup) => {
    if (isCollapsed) {
      onToggleCollapse();
    }
    setOpenGroups((prev) => ({
      ...prev,
      [group.id]: true,
    }));
    if (group.primaryPath) {
      navigate(group.primaryPath);
      handleNavClick();
    }
  };

  const navGroups: NavGroup[] = [
    {
      id: 'dashboard',
      title: 'TABLEAU DE BORD',
      primaryPath: '/dashboard',
      icon: LayoutDashboard,
      items: [
        { name: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard, isAvailable: true },
      ],
    },
    {
      id: 'admin',
      title: 'ADMINISTRATION',
      primaryPath: '/users',
      icon: Users,
      items: [
        { name: 'Utilisateurs', path: '/users', icon: Users, isAvailable: true },
        { name: 'Rôles', path: '/roles', icon: ShieldCheck, isAvailable: true },
        { name: 'Permissions', path: '/permissions', icon: Key, isAvailable: true },
      ],
    },
    {
      id: 'catalog',
      title: 'CATALOGUE',
      primaryPath: '/products',
      icon: Package,
      items: [
        { name: 'Produits', path: '/products', icon: Package, isAvailable: true },
        { name: 'Catégories', path: '/categories', icon: Layers, isAvailable: true },
        { name: 'Types de produits', path: '/product-types', icon: Tag, isAvailable: true },
        { name: 'Marques', path: '/brands', icon: Award, isAvailable: true },
        { name: 'Unités de mesure', path: '/units', icon: Scale, isAvailable: true },
      ],
    },
    {
      id: 'commercial',
      title: 'VENTES & ACHATS',
      primaryPath: '/clients',
      icon: ShoppingCart,
      items: [
        { name: 'Clients', path: '/clients', icon: Users, isAvailable: true },
        { name: 'Devis & Ventes', path: '/sales', icon: ShoppingCart, isAvailable: false },
        { name: 'Fournisseurs', path: '/fournisseurs', icon: ShoppingBag, isAvailable: true },
        { name: 'Achats', path: '/achats', icon: ShoppingBag, isAvailable: true },
        { name: 'Factures', path: '/invoices', icon: FileText, isAvailable: false },
      ],
    },
    {
      id: 'stock',
      title: 'STOCKS & DÉPÔTS',
      primaryPath: '/stock',
      icon: Boxes,
      items: [
        { name: 'Niveaux de stock', path: '/stock', icon: Boxes, isAvailable: true },
        { name: 'Dépôts & Magasins', path: '/depots', icon: Warehouse, isAvailable: true },
        { name: 'Mouvements de stock', path: '/stock/mouvements', icon: History, isAvailable: true },
        { name: 'Transferts Inter-Dépôts', path: '/stock/transferts', icon: ArrowRightLeft, isAvailable: true },
        { name: 'Inventaires Physiques', path: '/stock/inventaires', icon: ClipboardList, isAvailable: true },
      ],
    },
    {
      id: 'services',
      title: 'INTERVENTIONS & SAV',
      icon: Wrench,
      items: [
        { name: 'Interventions', path: '/interventions', icon: Wrench, isAvailable: false },
        { name: 'Tickets Support', path: '/tickets', icon: LifeBuoy, isAvailable: false },
        { name: 'Dépenses', path: '/expenses', icon: Receipt, isAvailable: false },
        { name: 'Planning', path: '/planning', icon: Calendar, isAvailable: false },
      ],
    },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-app-sidebar border-r border-app-border flex flex-col transition-all duration-300 ease-in-out lg:static ${
        isCollapsed ? 'w-20' : 'w-64'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      {/* Official Pesage 2000 Logo Header */}
      <div className="p-3.5 border-b border-app-border bg-app-surface-subtle flex items-center justify-between shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-1.5 rounded-xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center shrink-0">
              <img
                src="/branding/pesage-2000-logo.png"
                alt="Pesage 2000"
                className="h-7 w-auto object-contain max-w-[120px]"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs text-app-text block tracking-tight truncate">
                PESAGE 2000
              </span>
              <span className="text-[10px] text-pesage-orange font-semibold uppercase tracking-wider block truncate">
                Gestion Commerciale
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-xl bg-pesage-blue text-white shadow-xs hover:bg-pesage-blue-dark transition-all"
              title="Pesage 2000 ERP - Déplier le menu"
            >
              <Scale className="w-5 h-5 text-pesage-orange-light" />
            </button>
          </div>
        )}

        {/* Desktop Collapse Button */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Replier le menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Content Area */}
      <div className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isGroupOpen = openGroups[group.id] ?? true;
          const isGroupActive = group.items.some((item) => item.path === location.pathname);

          if (isCollapsed) {
            return (
              <button
                key={group.id}
                onClick={() => handleCollapsedGroupClick(group)}
                title={group.title}
                className={`w-full py-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isGroupActive
                    ? 'bg-pesage-blue text-white shadow-xs'
                    : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
                }`}
              >
                <GroupIcon className="w-5 h-5" />
              </button>
            );
          }

          return (
            <div key={group.id} className="space-y-1">
              <button
                onClick={() => handleExpandedGroupHeaderClick(group)}
                className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-app-text-muted uppercase tracking-wider hover:text-app-text transition-colors group"
              >
                <div className="flex items-center space-x-2 truncate">
                  <GroupIcon className="w-3.5 h-3.5 text-pesage-orange shrink-0" />
                  <span className="truncate">{group.title}</span>
                </div>
                <div className="text-app-text-muted group-hover:text-app-text transition-transform">
                  {isGroupOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Accordion Child Items */}
              {isGroupOpen && (
                <div className="space-y-1 pl-1">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;

                    if (!item.isAvailable) {
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-normal text-app-text-muted bg-app-surface-subtle/50 cursor-not-allowed opacity-60"
                          title={`${item.name} (Module disponible prochainement)`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <ItemIcon className="w-4 h-4 shrink-0 text-app-text-muted" />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-app-border/40 text-app-text-muted">
                            À venir
                          </span>
                        </div>
                      );
                    }

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-pesage-blue text-white shadow-xs font-semibold'
                              : 'text-app-text-secondary hover:text-app-text hover:bg-app-surface-hover'
                          }`
                        }
                      >
                        <ItemIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User Footer / Logout (Pinned at Bottom) */}
      <div className="p-3 border-t border-app-border bg-app-surface-subtle shrink-0 space-y-2">
        {!isCollapsed ? (
          <>
            {user && (
              <div className="flex items-center space-x-3 px-1">
                <div className="w-8 h-8 rounded-full bg-pesage-blue text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                  {user.first_name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-app-text truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-[10px] text-app-text-muted truncate">{user.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={logout}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-app-surface hover:bg-rose-500/10 hover:text-rose-600 text-app-text-secondary text-xs font-semibold transition-all border border-app-border hover:border-rose-500/30"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Déconnexion</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-2 py-1">
            {user && (
              <div
                className="w-8 h-8 rounded-full bg-pesage-blue text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0"
                title={`${user.first_name} ${user.last_name} (${user.email})`}
              >
                {user.first_name?.[0] || 'U'}
              </div>
            )}
            <button
              onClick={logout}
              title="Déconnexion"
              className="p-2 rounded-xl bg-app-surface hover:bg-rose-500/10 text-app-text-secondary hover:text-rose-600 transition-colors border border-app-border"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
