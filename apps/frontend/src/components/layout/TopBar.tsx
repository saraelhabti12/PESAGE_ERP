import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { AppNotification } from '@/types/notification';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Calendar,
  PanelLeftOpen,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { formatDateShort } from '@/lib/formatters';

interface TopBarProps {
  onToggleMobileSidebar?: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleMobileSidebar,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const primaryRole = user?.roles?.[0]?.name || 'Utilisateur';

  // Fetch unread count & notifications
  const fetchUnreadCount = useCallback(async () => {
    if (!user || !localStorage.getItem('access_token')) return;
    try {
      const res = await api.get<{ unread_count: number }>('/api/v1/notifications/unread-count');
      setUnreadCount(res.data.unread_count);
    } catch {
      // Non-blocking fallback
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user || !localStorage.getItem('access_token')) return;
    setIsLoadingNotifs(true);
    try {
      const res = await api.get<AppNotification[]>('/api/v1/notifications?limit=20');
      setNotifications(res.data || []);
      const unread = res.data.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      // Non-blocking fallback
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleNotifs = () => {
    const nextState = !notifMenuOpen;
    setNotifMenuOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (notif: AppNotification) => {
    if (!notif.is_read) {
      try {
        await api.post(`/api/v1/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed marking notification as read', err);
      }
    }

    if (notif.link) {
      setNotifMenuOpen(false);
      navigate(notif.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/api/v1/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed marking all notifications as read', err);
    }
  };

  const renderNotifIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-pesage-blue shrink-0 mt-0.5" />;
    }
  };

  return (
    <header className="h-16 px-4 md:px-6 bg-app-topbar/95 backdrop-blur-md border-b border-app-border flex items-center justify-between shrink-0 z-30 shadow-xs transition-colors duration-200 sticky top-0">
      {/* Left Navigation Controls */}
      <div className="flex items-center space-x-3">
        {/* Mobile Drawer Trigger */}
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Expand Button */}
        {isSidebarCollapsed && (
          <button
            onClick={onToggleSidebarCollapse}
            className="hidden lg:flex p-2 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Déplier le menu principal"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        {/* Date Context */}
        <div className="hidden sm:flex items-center space-x-2 text-app-text-secondary text-xs font-semibold bg-app-surface-subtle px-3 py-1.5 rounded-xl border border-app-border">
          <Calendar className="w-3.5 h-3.5 text-pesage-orange" />
          <span>{formatDateShort(new Date())}</span>
        </div>
      </div>

      {/* Right Controls: Notifications, Theme Switcher & User Menu */}
      <div className="flex items-center space-x-3">
        {/* Notifications Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleToggleNotifs}
            className="relative p-2 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-pesage-orange rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Window */}
          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-app-surface border border-app-border shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-app-text-primary">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/50 text-pesage-orange border border-orange-200 dark:border-orange-800 rounded-full">
                      {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Tout marquer comme lu
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-app-border">
                {isLoadingNotifs ? (
                  <div className="p-6 text-center text-xs text-app-text-muted">
                    Chargement des notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center space-y-1">
                    <Bell className="w-6 h-6 text-app-text-muted mx-auto opacity-40 mb-2" />
                    <p className="text-xs font-semibold text-app-text-primary">Aucune notification</p>
                    <p className="text-[11px] text-app-text-muted">Vous êtes parfaitement à jour.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkAsRead(notif)}
                      className={`p-3.5 text-left flex items-start gap-3 cursor-pointer transition-colors ${
                        notif.is_read
                          ? 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40 opacity-75'
                          : 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 font-medium'
                      }`}
                    >
                      {renderNotifIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-app-text-primary truncate">{notif.title}</p>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-pesage-orange shrink-0"></span>
                          )}
                        </div>
                        <p className="text-[11px] text-app-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-app-text-muted">
                          <span>
                            {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                          {notif.link && (
                            <span className="text-pesage-blue flex items-center gap-0.5">
                              Voir <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* High-End Segmented Theme Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-app-surface-subtle border border-app-border text-xs font-semibold">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all duration-150 ${
              theme === 'light'
                ? 'bg-white text-pesage-blue shadow-xs font-bold border border-app-border/50'
                : 'text-app-text-muted hover:text-app-text'
            }`}
            title="Activer le Mode Clair (Light Mode)"
          >
            <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-pesage-orange font-bold' : ''}`} />
            <span className="hidden sm:inline">Clair</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all duration-150 ${
              theme === 'dark'
                ? 'bg-pesage-blue text-white shadow-xs font-bold'
                : 'text-app-text-muted hover:text-app-text'
            }`}
            title="Activer le Mode Sombre (Dark Mode)"
          >
            <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-pesage-orange' : ''}`} />
            <span className="hidden sm:inline">Sombre</span>
          </button>
        </div>

        {/* User Profile Menu */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center space-x-2.5 p-1.5 pr-2.5 rounded-xl hover:bg-app-surface-hover transition-all border border-transparent hover:border-app-border"
            >
              <div className="w-8 h-8 rounded-full bg-pesage-blue text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user.first_name?.[0] || 'A'}
              </div>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-xs font-bold text-app-text leading-tight">
                  {user.first_name} {user.last_name}
                </span>
                <span className="text-[10px] text-app-text-muted font-semibold">
                  {primaryRole}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-app-text-muted" />
            </button>

            {/* Dropdown Menu Popup */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-app-surface border border-app-border shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header User Info */}
                <div className="px-4 py-3 border-b border-app-border bg-app-surface-subtle">
                  <p className="text-xs font-bold text-app-text">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-[11px] text-app-text-muted truncate mt-0.5">
                    {user.email}
                  </p>
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-pesage-blue/10 text-pesage-blue dark:text-pesage-blue-light text-[10px] font-bold uppercase tracking-wider border border-pesage-blue/20">
                    {primaryRole}
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/profil');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-app-text hover:bg-app-surface-hover flex items-center space-x-2.5 transition-colors"
                  >
                    <User className="w-4 h-4 text-app-text-muted" />
                    <span>Mon profil</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/parametres');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-app-text hover:bg-app-surface-hover flex items-center space-x-2.5 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-app-text-muted" />
                    <span>Paramètres</span>
                  </button>
                </div>

                {/* Logout Divider */}
                <div className="border-t border-app-border pt-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-500/10 flex items-center space-x-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
