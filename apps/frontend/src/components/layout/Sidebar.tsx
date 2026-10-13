import React, { useState, useEffect, useMemo } from 'react';
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
  Truck,
  RotateCcw,
  DollarSign,
  Briefcase,
  BarChart3,
  TrendingUp,
  User as UserIcon,
  Settings as SettingsIcon,
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

interface NavSection {
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

  // Helper to check if a navigation item matches current URL or active sub-route
  const isItemActive = (itemPath: string, currentPath: string): boolean => {
    if (itemPath === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    if (currentPath === itemPath) return true;
    if (currentPath.startsWith(`${itemPath}/`)) return true;

    // Aliases
    if (itemPath === '/depots' && (currentPath === '/warehouses' || currentPath.startsWith('/warehouses/'))) return true;
    if (itemPath === '/achats' && (currentPath === '/purchases' || currentPath.startsWith('/purchases/'))) return true;
    if (itemPath === '/fournisseurs' && (currentPath === '/suppliers' || currentPath.startsWith('/suppliers/'))) return true;
    if (itemPath === '/devis' && (currentPath === '/quotes' || currentPath.startsWith('/quotes/'))) return true;
    if (itemPath === '/ventes' && (currentPath === '/sales' || currentPath.startsWith('/sales/'))) return true;
    if (itemPath === '/livraisons' && (currentPath === '/delivery-notes' || currentPath.startsWith('/delivery-notes/'))) return true;
    if (itemPath === '/factures-vente' && (currentPath === '/factures' || currentPath === '/invoices' || currentPath.startsWith('/factures-vente'))) return true;
    if (itemPath === '/factures-achat' && (currentPath === '/factures-fournisseurs' || currentPath.startsWith('/factures-achat'))) return true;
    if (itemPath === '/avoirs' && (currentPath === '/credit-notes' || currentPath.startsWith('/credit-notes/'))) return true;
    if (itemPath === '/depenses' && (currentPath === '/expenses' || currentPath.startsWith('/expenses/'))) return true;
    if (itemPath === '/maintenance' && (currentPath === '/interventions' || currentPath === '/maintenance' || currentPath.startsWith('/maintenance/'))) return true;
    if (itemPath === '/personnel' && (currentPath === '/employees' || currentPath.startsWith('/employees/'))) return true;
    if (itemPath === '/vehicules' && (currentPath === '/vehicles' || currentPath === '/flotte')) return true;
    if (itemPath === '/rapports' && (currentPath === '/reports' || currentPath.startsWith('/reports/'))) return true;
    if (itemPath === '/profil' && currentPath === '/profile') return true;
    if (itemPath === '/parametres' && currentPath === '/settings') return true;

    return false;
  };

  // Standard Pesage 2000 Navigation Sections
  const navSections: NavSection[] = useMemo(
    () => [
      {
        id: 'commercial',
        title: 'CYCLE COMMERCIAL',
        primaryPath: '/clients',
        icon: ShoppingCart,
        items: [
          { name: 'Clients', path: '/clients', icon: Users, isAvailable: true },
          { name: 'Devis', path: '/devis', icon: FileText, isAvailable: true },
          { name: 'Commandes & Ventes', path: '/ventes', icon: ShoppingCart, isAvailable: true },
          { name: 'Bons de Livraison', path: '/livraisons', icon: Truck, isAvailable: true },
          { name: 'Factures Vente', path: '/factures-vente', icon: Receipt, isAvailable: true },
          { name: 'Avoirs Clients', path: '/avoirs', icon: RotateCcw, isAvailable: true },
          { name: 'Fournisseurs', path: '/fournisseurs', icon: ShoppingBag, isAvailable: true },
          { name: 'Commandes d’Achat', path: '/achats', icon: ClipboardList, isAvailable: true },
          { name: 'Factures Achat', path: '/factures-achat', icon: Receipt, isAvailable: true },
        ],
      },
      {
        id: 'gestion',
        title: 'GESTION & EXPLOITATION',
        primaryPath: '/maintenance',
        icon: DollarSign,
        items: [
          { name: 'Interventions & Maintenance', path: '/maintenance', icon: Wrench, isAvailable: true },
          { name: 'Personnel & RH', path: '/personnel', icon: Briefcase, isAvailable: true },
          { name: 'Véhicules & Flotte', path: '/vehicules', icon: Truck, isAvailable: true },
          { name: 'Dépenses & Caisse', path: '/depenses', icon: DollarSign, isAvailable: true },
          { name: 'Rapports & Statistiques', path: '/rapports', icon: BarChart3, isAvailable: true },
        ],
      },
      {
        id: 'catalog',
        title: 'CATALOGUE PRODUITS',
        primaryPath: '/products',
        icon: Package,
        items: [
          { name: 'Produits & Balances', path: '/products', icon: Package, isAvailable: true },
          { name: 'Catégories', path: '/categories', icon: Layers, isAvailable: true },
          { name: 'Types de produits', path: '/product-types', icon: Tag, isAvailable: true },
          { name: 'Marques', path: '/brands', icon: Award, isAvailable: true },
          { name: 'Unités de mesure', path: '/units', icon: Scale, isAvailable: true },
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
        id: 'admin',
        title: 'ADMINISTRATION & SÉCURITÉ',
        primaryPath: '/users',
        icon: ShieldCheck,
        items: [
          { name: 'Utilisateurs', path: '/users', icon: Users, isAvailable: true },
          { name: 'Rôles & Accès', path: '/roles', icon: ShieldCheck, isAvailable: true },
          { name: 'Permissions', path: '/permissions', icon: Key, isAvailable: true },
          { name: 'Mon Profil', path: '/profil', icon: UserIcon, isAvailable: true },
          { name: 'Paramètres Généraux', path: '/parametres', icon: SettingsIcon, isAvailable: true },
        ],
      },
    ],
    []
  );

  // Accordion state persistence
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('pesage_sidebar_sections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      commercial: true,
      gestion: true,
      catalog: true,
      stock: true,
      admin: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('pesage_sidebar_sections', JSON.stringify(openSections));
  }, [openSections]);

  // Auto-expand parent section when navigating to a child page
  useEffect(() => {
    const path = location.pathname;
    navSections.forEach((section) => {
      const hasActiveChild = section.items.some((item) => isItemActive(item.path, path));
      if (hasActiveChild) {
        setOpenSections((prev) => ({
          ...prev,
          [section.id]: true,
        }));
      }
    });
  }, [location.pathname, navSections]);

  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile();
  };

  const handleToggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleCollapsedSectionClick = (section: NavSection) => {
    if (isCollapsed) {
      onToggleCollapse();
    }
    setOpenSections((prev) => ({
      ...prev,
      [section.id]: true,
    }));
    if (section.primaryPath) {
      navigate(section.primaryPath);
      handleNavClick();
    }
  };

  const isDashboardActive = isItemActive('/dashboard', location.pathname);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-app-sidebar border-r border-app-border flex flex-col transition-all duration-300 ease-in-out lg:static lg:h-screen lg:shrink-0 ${
        isCollapsed ? 'w-20' : 'w-72'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      {/* 1. Official Pesage 2000 Logo & Toggle Header */}
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
              className="p-1.5 rounded-xl bg-white shadow-xs border border-slate-200/80 hover:border-pesage-orange/50 transition-all flex items-center justify-center shrink-0 group cursor-pointer"
              title="Pesage 2000 ERP - Déplier le menu"
            >
              <img
                src="/branding/pesage-2000-logo.png"
                alt="Pesage 2000"
                className="h-6 w-6 object-contain group-hover:scale-105 transition-transform"
              />
            </button>
          </div>
        )}

        {/* Desktop Collapse Button */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors cursor-pointer"
            title="Replier le menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Navigation Content Area (Independently Scrollable Container) */}
      <div className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {/* Top-Level: TABLEAU DE BORD */}
        {!isCollapsed ? (
          <NavLink
            to="/dashboard"
            onClick={handleNavClick}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isDashboardActive
                ? 'bg-pesage-blue text-white shadow-xs'
                : 'text-app-text-secondary hover:text-app-text hover:bg-app-surface-hover'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-pesage-orange" />
            <span className="truncate">TABLEAU DE BORD</span>
          </NavLink>
        ) : (
          <NavLink
            to="/dashboard"
            onClick={handleNavClick}
            title="Tableau de bord"
            className={`w-full py-2.5 rounded-xl flex flex-col items-center justify-center transition-all ${
              isDashboardActive
                ? 'bg-pesage-blue text-white shadow-xs'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 text-pesage-orange" />
          </NavLink>
        )}

        {/* Accordion Sections */}
        {navSections.map((section) => {
          const SectionIcon = section.icon;
          const isSectionOpen = openSections[section.id] ?? false;
          const isSectionActive = section.items.some((item) => isItemActive(item.path, location.pathname));

          // Collapsed state view: show icons with tooltip
          if (isCollapsed) {
            return (
              <button
                key={section.id}
                onClick={() => handleCollapsedSectionClick(section)}
                title={section.title}
                className={`w-full py-2.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSectionActive
                    ? 'bg-pesage-blue text-white shadow-xs'
                    : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
                }`}
              >
                <SectionIcon className="w-5 h-5" />
              </button>
            );
          }

          // Expanded state view: Collapsible Accordion
          return (
            <div key={section.id} className="space-y-1">
              {/* Accordion Header */}
              <button
                onClick={() => handleToggleSection(section.id)}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer group ${
                  isSectionActive
                    ? 'text-pesage-blue dark:text-blue-400 font-bold'
                    : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover/60'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <SectionIcon className={`w-3.5 h-3.5 shrink-0 ${isSectionActive ? 'text-pesage-orange' : 'text-app-text-muted group-hover:text-pesage-orange transition-colors'}`} />
                  <span className="truncate">{section.title}</span>
                </div>
                <div className="text-app-text-muted group-hover:text-app-text transition-transform">
                  {isSectionOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Accordion Children */}
              {isSectionOpen && (
                <div className="space-y-1 pl-1 pt-0.5">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = isItemActive(item.path, location.pathname);

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
                        className={`flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-pesage-blue text-white shadow-xs font-semibold'
                            : 'text-app-text-secondary hover:text-app-text hover:bg-app-surface-hover'
                        }`}
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

      {/* 3. User Profile Area & Logout (Pinned at Bottom) */}
      <div className="p-3 border-t border-app-border bg-app-surface-subtle shrink-0 space-y-2">
        {!isCollapsed ? (
          <>
            {user && (
              <div className="flex items-center space-x-3 px-1">
                <div className="w-8 h-8 rounded-full bg-pesage-blue text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                  {user.first_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
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
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-app-surface hover:bg-rose-500/10 hover:text-rose-600 text-app-text-secondary text-xs font-semibold transition-all border border-app-border hover:border-rose-500/30 cursor-pointer"
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
                title={`${user.first_name || ''} ${user.last_name || ''} (${user.email})`}
              >
                {user.first_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <button
              onClick={logout}
              title="Déconnexion"
              className="p-2 rounded-xl bg-app-surface hover:bg-rose-500/10 text-app-text-secondary hover:text-rose-600 transition-colors border border-app-border cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
